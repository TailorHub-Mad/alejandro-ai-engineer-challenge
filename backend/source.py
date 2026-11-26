"""Extract the six steps in DAFF section 8.1, preserving the nested If/Then tables."""
from hashlib import sha256
from io import BytesIO
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "data/raw/A3_DAFF_work_instruction_empty_bulk_vessel.pdf"
SOURCE_URL = (
    "https://www.agriculture.gov.au/sites/default/files/sitecollectiondocuments/"
    "biosecurity/export/plants-plant-products/plant-exports-manual/work-instruction-empty-bulk-vessel.pdf"
)
SECTION_TITLE = "Inspecting the inside of an empty vessel hold"
PDF_SHA256 = "50b86ae9a149d557a4e2fbd0e55cd881da0df62a8c23941dd42d4f0dbd320c81"


def clean(text):
    # The source font maps round bullets to the replacement character.
    return " ".join(text.replace("\ufffd", " • ").split())


def reviewed_pdf():
    if not PDF.is_file():
        raise FileNotFoundError(f"Download DAFF work instruction v7.0 to {PDF}. See README.")
    data = PDF.read_bytes()
    if sha256(data).hexdigest() != PDF_SHA256:
        raise ValueError("This PDF differs from the reviewed DAFF v7.0 edition. Check the source before indexing.")
    return data


def procedure_rows(page):
    """Locate each numbered step and its nested decision tables."""
    tables = page.find_tables()
    if not tables:
        raise ValueError(f"Missing procedure table on page {page.page_number}")
    outer, *nested = sorted(tables, key=lambda table: table.bbox[0])
    for row in outer.rows[1:]:
        number_cell, action_cell = [box for box in row.cells if box]
        step = int(page.crop(number_cell).extract_text().strip().rstrip("."))
        branches = [table for table in nested if row.bbox[1] <= table.bbox[1] < row.bbox[3]]
        yield step, row.bbox, action_cell, branches


def step_cells(page):
    """Yield each step's introductory cell, then its condition/action cell pairs."""
    for step, _, action_cell, branches in procedure_rows(page):
        x0, top, x1, bottom = action_cell
        intro_bottom = branches[0].bbox[1] if branches else bottom
        groups = [((x0, top, x1, intro_bottom),)]
        for table in branches:
            header = "".join(page.crop(box).extract_text() for box in table.rows[0].cells if box)
            if "If" not in header or "Then" not in header:
                raise ValueError(f"Unexpected decision table at step {step}")
            for row in table.rows[1:]:
                condition, action = (box for box in row.cells if box)
                groups.append((condition, action))
        yield step, groups


def quote_cells(text):
    """Return the verbatim parts of the indexed step, excluding reflowed table labels."""
    for paragraph in text.split("\n\n"):
        condition, arrow, action = paragraph.partition(" → ")
        if condition.startswith("If ") and arrow:
            yield condition[3:]
            yield action
        else:
            yield paragraph


def quote_occurrences(cells, quote):
    """Count exact spans within individual cells, including overlapping matches."""
    if not isinstance(quote, str) or not quote or quote != quote.strip():
        return 0
    count = 0
    for text in cells:
        start = text.find(quote)
        while start >= 0:
            count += 1
            start = text.find(quote, start + 1)
    return count


def extract_chunks():
    chunks = []
    with pdfplumber.open(BytesIO(reviewed_pdf())) as pdf:
        for page in pdf.pages[19:22]:
            for step, groups in step_cells(page):
                (intro,), *decisions = groups
                lines = [clean(page.crop(intro).extract_text())]
                for cells in decisions:
                    condition, action = (clean(page.crop(box).extract_text()) for box in cells)
                    lines.append(f"If {condition} → {action}")
                chunks.append({
                    "id": f"A3-8.1-{step:02d}", "source": "A3", "page": page.page_number,
                    "section": "8.1", "step": step, "text": "\n\n".join(lines),
                })
    if [chunk["step"] for chunk in chunks] != list(range(1, 7)):
        raise ValueError("Expected DAFF v7.0 section 8.1 steps 1–6. Check the source edition.")
    return chunks
