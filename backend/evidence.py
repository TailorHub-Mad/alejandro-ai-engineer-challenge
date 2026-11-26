"""Highlight verbatim excerpts in their original PDF table cells."""
from functools import lru_cache
from io import BytesIO
from itertools import groupby
from operator import itemgetter

import pdfplumber
from pdfplumber.utils import objects_to_bbox
from pypdf import PdfWriter
from pypdf.annotations import Highlight
from pypdf.generic import ArrayObject, Destination, Fit, FloatObject, NameObject, TextStringObject

from .source import quote_occurrences, step_cells


class QuoteNotFound(ValueError):
    """The supplied text is not a drawable quotation in the cited step."""


def mapped_cell(page, box):
    """Apply source.clean's whitespace/bullet rules while retaining each glyph's line."""
    text, positions = [], []
    line = 0
    for raw, glyph in page.crop(box).get_textmap().tuples:
        if raw == "\n":
            line += 1
        for char in raw.replace("\ufffd", " • "):
            if char.isspace():
                if text and text[-1] != " ":
                    text.append(" ")
                    positions.append(None)
            else:
                text.append(char)
                positions.append((line, glyph))
    return "".join(text).rstrip(), positions


@lru_cache(maxsize=1)
def passage_locations(pdf_bytes):
    locations = {}
    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages[19:22]:
            for step, groups in step_cells(page):
                cells = [mapped_cell(page, box) for group in groups for box in group]
                locations[f"A3-8.1-{step:02d}"] = (page.page_number, page.height, cells)
    return locations


def quote_rectangles(cells, quote, page_height):
    """Draw the unique span in the cited step, preserving physical line breaks."""
    count = quote_occurrences((text for text, _ in cells), quote)
    if count == 0:
        raise QuoteNotFound("The quotation does not appear in the cited passage.")
    if count > 1:
        raise QuoteNotFound("The quotation appears more than once in the cited step. Supply a longer, unique quotation.")
    for text, positions in cells:
        start = text.find(quote)
        if start >= 0:
            matched = filter(None, positions[start:start + len(quote)])
            for _, line in groupby(matched, key=itemgetter(0)):
                left, top, right, bottom = objects_to_bbox([glyph for _, glyph in line])
                yield left, page_height - bottom, right, page_height - top
            return


@lru_cache(maxsize=8)
def highlighted_pdf(pdf_bytes, passage_id, quote):
    number, height, cells = passage_locations(pdf_bytes)[passage_id]
    rectangles = list(quote_rectangles(cells, quote, height))
    if not rectangles:
        raise QuoteNotFound("The quotation does not appear in the cited passage.")

    writer = PdfWriter(clone_from=BytesIO(pdf_bytes))
    page = writer.pages[number - 1]
    for rect in rectangles:
        left, bottom, right, top = rect
        quad = ArrayObject(FloatObject(n) for n in (left, top, right, top, left, bottom, right, bottom))
        highlight = Highlight(rect=rect, quad_points=quad, highlight_color="fff1a8", printing=True)
        highlight[NameObject("/Contents")] = TextStringObject(quote)
        writer.add_annotation(page, highlight)
    writer.open_destination = Destination(passage_id, page.indirect_reference, Fit.fit_horizontally(rectangles[0][3] + 6))
    output = BytesIO()
    writer.write(output)
    return output.getvalue()
