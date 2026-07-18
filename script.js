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
  toast: document.querySelector("#toast"),
};

let hasGeneratedCertificate = false;

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

    const exportSvg = await inlineSvgImages(elements.svg);
    const svgMarkup = new XMLSerializer().serializeToString(exportSvg);
    const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const image = await loadImage(svgUrl);

    const canvas = document.createElement("canvas");
    canvas.width = 2800;
    canvas.height = 1980;

    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    URL.revokeObjectURL(svgUrl);

    canvas.toBlob((blob) => {
      if (!blob) {
        showToast("PNG export failed.");
        return;
      }

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileNameFromParticipant();
      link.click();
      URL.revokeObjectURL(link.href);
      showToast("PNG downloaded.");
    }, "image/png", 1);
  } catch (error) {
    showToast("PNG export works from GitHub Pages or a local web server.");
  } finally {
    elements.downloadButton.disabled = false;
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
  document.body.classList.remove("is-generated");
}

elements.form.addEventListener("input", updateCertificate);
elements.generateButton.addEventListener("click", revealCertificate);
elements.downloadButton.addEventListener("click", downloadPng);
elements.printButton.addEventListener("click", () => {
  ensureGenerated();
  window.print();
});
elements.resetButton.addEventListener("click", resetForm);

updateCertificate();
