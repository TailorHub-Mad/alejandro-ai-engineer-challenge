from io import BytesIO
import unittest
from unittest.mock import patch

import numpy as np
import pdfplumber
import pypdfium2 as pdfium
from fastapi import HTTPException
from pypdf import PdfReader

from backend.app import cited_pdf
from backend.evidence import highlighted_pdf, passage_locations, QuoteNotFound
from backend.source import clean, extract_chunks, quote_cells, quote_occurrences, reviewed_pdf


def highlights(page):
    annotations = (ref.get_object() for ref in page.get("/Annots", []))
    return [a for a in annotations if a["/Subtype"] == "/Highlight"]


def text_in_rect(page, rect):
    left, bottom, right, top = rect
    def inside(obj):
        return (obj["object_type"] == "char"
                and left <= (obj["x0"] + obj["x1"]) / 2 <= right
                and bottom <= (obj["y0"] + obj["y1"]) / 2 <= top)
    return clean(page.filter(inside).extract_text())


PURPOSE = ("Any residues or contaminants found during the hold inspection and placed on the tank top "
           "by the vessel crew is be inspected by the AO for evidence of infestation.")


class CitationPdfTests(unittest.TestCase):
    def test_citable_text_matches_physical_cells_for_the_entire_edition(self):
        locations = passage_locations(reviewed_pdf())
        for chunk in extract_chunks():
            _, _, cells = locations[chunk["id"]]
            self.assertEqual(list(quote_cells(chunk["text"])), [text for text, _ in cells])

    def test_each_pdf_highlights_only_quoted_characters_in_original_lines(self):
        cases = [
            (1, 20, "retained on the tank top in piles for inspection", 2),
            (2, 20, "the ladder hand railing, the base of the ladder and behind the ladder", 1),
            (3, 21, "bilge scraper may be used to scrape the underside of the bilge entrance to "
                    "dislodge residues and contaminants and aid inspection", 3),
            (4, 22, PURPOSE, 2),
            (5, 22, "perform inspection tasks in reverse", 1),
            (6, 22, "next vessel inspection task", 1),
        ]
        source = reviewed_pdf()
        with pdfplumber.open(BytesIO(source)) as original:
            for step, number, quote, lines in cases:
                with self.subTest(step=step):
                    data = highlighted_pdf(source, f"A3-8.1-{step:02d}", quote)
                    pdf = PdfReader(BytesIO(data))
                    self.assertEqual(len(pdf.pages), len(original.pages))
                    self.assertEqual(pdf.get_destination_page_number(pdf.open_destination), number - 1)
                    marks = highlights(pdf.pages[number - 1])
                    self.assertEqual(len(marks), lines)
                    self.assertTrue(all(a["/Contents"] == quote and len(a["/QuadPoints"]) == 8 for a in marks))
                    actual = " ".join(text_in_rect(original.pages[number - 1], a["/Rect"]) for a in marks)
                    self.assertEqual(actual, quote)

    def test_repeated_text_is_rejected_until_the_quote_identifies_one_row(self):
        for ambiguous in ("record inspection findings", "the ladder"):
            with self.subTest(quote=ambiguous), self.assertRaisesRegex(QuoteNotFound, "longer, unique"):
                highlighted_pdf(reviewed_pdf(), "A3-8.1-02", ambiguous)
        quote = "record inspection findings • inform the LCM"
        data = highlighted_pdf(reviewed_pdf(), "A3-8.1-02", quote)
        marks = highlights(PdfReader(BytesIO(data)).pages[19])
        with pdfplumber.open(BytesIO(reviewed_pdf())) as original:
            highlighted = " ".join(text_in_rect(original.pages[19], mark["/Rect"]) for mark in marks)
            self.assertEqual(highlighted, quote)

    def test_occurrences_are_exact_and_never_span_physical_cells(self):
        self.assertEqual(quote_occurrences(["aaa"], "aa"), 2)
        self.assertEqual(quote_occurrences(["ladder hand", "railing"], "hand railing"), 0)
        self.assertEqual(quote_occurrences(["Ladder hand railing"], "ladder"), 0)

    def test_highlights_render_over_the_quote_without_tinting_the_rest_of_the_step(self):
        def pixels(data):
            with pdfium.PdfDocument(data) as doc:
                return np.array(doc[21].render(scale=1, draw_annots=True).to_pil().convert("RGB"))

        source = reviewed_pdf()
        data = highlighted_pdf(source, "A3-8.1-04", PURPOSE)
        changed = np.any(pixels(source) != pixels(data), axis=2)
        page = PdfReader(BytesIO(data)).pages[21]
        height = float(page.mediabox.height)
        permitted = np.zeros(changed.shape, dtype=bool)
        for mark in highlights(page):
            left, bottom, right, top = map(float, mark["/Rect"])
            x0, x1 = int(left), int(right)
            y0, y1 = int(height - top), int(height - bottom)
            self.assertGreater(changed[y0 + 2:y1 - 2, x0 + 2:x1 - 2].mean(), 0.7)
            permitted[y0 - 3:y1 + 4, x0 - 3:x1 + 4] = True
        self.assertFalse(changed[~permitted].any())

    def test_invalid_quotes_do_not_fall_back_to_a_whole_step(self):
        for quote in ["", "  ", "Any residues or contamination", "If clear →", "Determine the next vessel inspection task."]:
            with self.subTest(quote=quote), self.assertRaises(QuoteNotFound):
                highlighted_pdf(reviewed_pdf(), "A3-8.1-04", quote)

    def test_route_returns_inline_pdf_and_reports_unknown_quote_passage_or_edition(self):
        quote = "next vessel inspection task"
        response = cited_pdf("A3-8.1-06", quote)
        self.assertEqual(response.media_type, "application/pdf")
        self.assertIn("inline", response.headers["content-disposition"])
        for step, excerpt, status in [(6, "not present", 422), (2, "record inspection findings", 422), (99, quote, 404)]:
            with self.subTest(step=step), self.assertRaises(HTTPException) as error:
                cited_pdf(f"A3-8.1-{step:02d}", excerpt)
            self.assertEqual(error.exception.status_code, status)
        with patch("backend.app.reviewed_pdf", side_effect=ValueError("different edition")):
            with self.assertRaises(HTTPException) as error:
                cited_pdf("A3-8.1-06", quote)
            self.assertEqual(error.exception.status_code, 503)
