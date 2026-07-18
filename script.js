const defaults = {
  participantName: "[NAME OF PARTICIPANT]",
  eventDate: "2026-07-18",
  activity: "SCHOOL-BASED ROBOTEACH 4.0",
  venue: "Almagro National High School, Almagro, Samar",
};

const elements = {
  form: document.querySelector("#certificateForm"),
  participantInput: document.querySelector("#participantNameInput"),
  dateInput: document.querySelector("#eventDateInput"),
  activityInput: document.querySelector("#activityInput"),
  venueInput: document.querySelector("#venueInput"),
  participantText: document.querySelector("#participantNameText"),
  activityText: document.querySelector("#activityText"),
  dateVenueText: document.querySelector("#dateVenueText"),
  svg: document.querySelector("#certificateSvg"),
  stage: document.querySelector("#certificateStage"),
  generateButton: document.querySelector("#generateButton"),
  downloadButton: document.querySelector("#downloadPngButton"),
  printButton: document.querySelector("#printButton"),
  resetButton: document.querySelector("#resetButton"),
  printSheet: document.querySelector("#printSheet"),
  printImage: document.querySelector("#printCertificateImage"),
  toast: document.querySelector("#toast"),
};

let hasGeneratedCertificate = false;
let printImageUrl = "";
let printRefreshTimer = 0;

function cleanSpaces(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function formatDisplayDate(value) {
  if (!value) return "[DATE]";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return cleanSpaces(value);

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function trimSentenceEnd(value) {
  return cleanSpaces(value).replace(/[.]+$/g, "");
}

function setSvgText(textElement, text) {
  textElement.textContent = text;
}

function fitText(textElement, maxWidth, baseSize, minSize) {
  textElement.style.fontSize = `${baseSize}px`;

  let size = baseSize;
  while (textElement.getComputedTextLength() > maxWidth && size > minSize) {
    size -= 1;
    textElement.style.fontSize = `${size}px`;
  }
}

function updateCertificate() {
  const participantName = cleanSpaces(elements.participantInput.value).toUpperCase() || defaults.participantName;
  const activity = cleanSpaces(elements.activityInput.value).toUpperCase() || defaults.activity;
  const venue = trimSentenceEnd(elements.venueInput.value) || defaults.venue;
  const date = formatDisplayDate(elements.dateInput.value);

  setSvgText(elements.participantText, participantName);
  setSvgText(elements.activityText, activity);
  setSvgText(elements.dateVenueText, `held on ${date} at ${venue}.`);

  fitText(elements.participantText, 880, 44, 25);
  fitText(elements.activityText, 820, 34, 22);
  fitText(elements.dateVenueText, 880, 18, 13);
}

function fileNameFromParticipant() {
  const participant = cleanSpaces(elements.participantInput.value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `certificate-${participant || "participant"}.png`;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function inlineSvgImages(svg) {
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `
    .eyebrow-text,
    .certificate-heading,
    .activity-text,
    .signer-name,
    .footer-text {
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 700;
    }

    .eyebrow-text {
      fill: #111827;
      font-size: 16px;
    }

    .certificate-heading {
      fill: #082b59;
      font-size: 49px;
    }

    .cyan-line {
      stroke: #00b9ea;
      stroke-width: 4;
    }

    .presented-text {
      fill: #41536b;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 21px;
      font-style: italic;
    }

    .participant-name {
      fill: #082b59;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 44px;
      font-weight: 700;
    }

    .name-line,
    .signature-line {
      stroke: #082b59;
      stroke-width: 2;
    }

    .lead-text {
      fill: #41536b;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 20px;
    }

    .activity-text {
      fill: #007fae;
      font-size: 34px;
    }

    .body-text {
      fill: #41536b;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 18px;
    }

    .signer-name {
      fill: #082b59;
      font-size: 18px;
    }

    .signer-role {
      fill: #52657b;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 15px;
    }

    .footer-text {
      fill: #111827;
      font-size: 13px;
    }
  `;
  clone.insertBefore(style, clone.firstChild);

  const imageElements = Array.from(clone.querySelectorAll("image"));
  await Promise.all(imageElements.map(async (image) => {
    const href = image.getAttribute("href") || image.getAttributeNS("http://www.w3.org/1999/xlink", "href");
    if (!href || href.startsWith("data:")) return;

    const response = await fetch(new URL(href, window.location.href));
    const dataUrl = await blobToDataUrl(await response.blob());
    image.setAttribute("href", dataUrl);
  }));

  return clone;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("PNG export failed."));
      }
    }, "image/png", 1);
  });
}

async function renderCertificatePngBlob() {
  const exportSvg = await inlineSvgImages(elements.svg);
  const svgMarkup = new XMLSerializer().serializeToString(exportSvg);
  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement("canvas");
    canvas.width = 2800;
    canvas.height = 1980;

    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await canvasToBlob(canvas);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function waitForPrintImage() {
  return new Promise((resolve, reject) => {
    if (elements.printImage.complete && elements.printImage.naturalWidth > 0) {
      resolve();
      return;
    }

    elements.printImage.onload = () => resolve();
    elements.printImage.onerror = reject;
  });
}

async function setPrintImage(blob) {
  if (printImageUrl) {
    URL.revokeObjectURL(printImageUrl);
  }

  printImageUrl = URL.createObjectURL(blob);
  elements.printImage.src = printImageUrl;
  await waitForPrintImage();
  document.body.classList.add("is-print-ready");
}

async function preparePrintImage() {
  ensureGenerated();
  const blob = await renderCertificatePngBlob();
  await setPrintImage(blob);
}

function schedulePrintImageRefresh() {
  if (!hasGeneratedCertificate) return;

  document.body.classList.remove("is-print-ready");
  window.clearTimeout(printRefreshTimer);
  printRefreshTimer = window.setTimeout(() => {
    preparePrintImage().catch(() => {});
  }, 350);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 3200);
}

function revealCertificate() {
  hasGeneratedCertificate = true;
  elements.stage.hidden = false;
  document.body.classList.add("is-generated");
  updateCertificate();
  elements.stage.scrollIntoView({ behavior: "smooth", block: "center" });
  schedulePrintImageRefresh();
}

function ensureGenerated() {
  if (!hasGeneratedCertificate) {
    revealCertificate();
  } else {
    updateCertificate();
  }
}

async function downloadPng() {
  elements.downloadButton.disabled = true;

  try {
    ensureGenerated();

    const blob = await renderCertificatePngBlob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileNameFromParticipant();
    link.click();
    URL.revokeObjectURL(link.href);
    showToast("PNG downloaded.");
  } catch (error) {
    showToast("PNG export works from GitHub Pages or a local web server.");
  } finally {
    elements.downloadButton.disabled = false;
  }
}

async function printCertificate() {
  elements.printButton.disabled = true;

  try {
    await preparePrintImage();
    document.body.classList.add("is-printing-certificate");
    window.print();
  } catch (error) {
    showToast("Print preparation failed. Try Download PNG, then print the downloaded file.");
  } finally {
    elements.printButton.disabled = false;
  }
}

function resetForm() {
  elements.participantInput.value = "";
  elements.dateInput.value = defaults.eventDate;
  elements.activityInput.value = defaults.activity;
  elements.venueInput.value = defaults.venue;
  updateCertificate();
  hasGeneratedCertificate = false;
  elements.stage.hidden = true;
  document.body.classList.remove("is-generated", "is-print-ready", "is-printing-certificate");
  window.clearTimeout(printRefreshTimer);
}

elements.form.addEventListener("input", () => {
  updateCertificate();
  schedulePrintImageRefresh();
});
elements.generateButton.addEventListener("click", revealCertificate);
elements.downloadButton.addEventListener("click", downloadPng);
elements.printButton.addEventListener("click", printCertificate);
elements.resetButton.addEventListener("click", resetForm);
window.addEventListener("afterprint", () => {
  document.body.classList.remove("is-printing-certificate");
});

updateCertificate();
