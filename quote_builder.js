//Staging Version
const COMPATIBILITY_DATA_URL =
  "https://store-jsj7fos9p1.mybigcommerce.com/content/JSON%20Files/Compatibility.json";

function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function normalizeSkuText(skuText) {
  if (!skuText) return "";
  return skuText.replace(/^sku\s*[:#-]?\s*/i, "").trim();
}

function normalizeCompatibilityLookup(value) {
  if (!value) return "";
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeCompatibilityName(value) {
  if (!value) return "";
  return String(value)
    .replace(/[\u201C\u201D"]/g, '"')
    .replace(/\\\"/g, '"')
    .replace(/[^a-zA-Z0-9\s\"-()]/g, "")
    .toLowerCase()
    .trim();
}

function buildCompatibilityIndexes(itemsBySku) {
  const normalizedSkuToKeys = {};
  const normalizedNameToKeys = {};

  Object.keys(itemsBySku).forEach((itemSku) => {
    const itemData = itemsBySku[itemSku] || {};
    const normalizedSku = normalizeCompatibilityLookup(itemSku);
    const normalizedName = normalizeCompatibilityName(itemData.name);

    if (normalizedSku) {
      if (!normalizedSkuToKeys[normalizedSku]) {
        normalizedSkuToKeys[normalizedSku] = [];
      }

      normalizedSkuToKeys[normalizedSku].push(itemSku);
    }

    if (normalizedName) {
      if (!normalizedNameToKeys[normalizedName]) {
        normalizedNameToKeys[normalizedName] = [];
      }

      normalizedNameToKeys[normalizedName].push(itemSku);
    }
  });

  return {
    normalizedSkuToKeys,
    normalizedNameToKeys,
  };
}

function resolveCompatibilityKey(cartItem, itemsBySku, itemIndexes) {
  const cartSku =
    cartItem && typeof cartItem === "object" ? cartItem.sku : cartItem;
  const cartTitle =
    cartItem && typeof cartItem === "object" ? cartItem.title : "";

  if (cartSku && itemsBySku[cartSku]) {
    return cartSku;
  }

  const normalizedTitle = normalizeCompatibilityName(cartTitle);
  if (!normalizedTitle) {
    return "";
  }

  const nameMatches = itemIndexes.normalizedNameToKeys[normalizedTitle];
  if (!nameMatches || nameMatches.length !== 1) {
    return "";
  }

  return nameMatches[0];
}

function chunkArray(items, maxChunkSize) {
  if (!Array.isArray(items) || maxChunkSize <= 0) {
    return [];
  }

  const chunks = [];
  for (let index = 0; index < items.length; index += maxChunkSize) {
    chunks.push(items.slice(index, index + maxChunkSize));
  }

  return chunks;
}

function mmToPx(mm) {
  return (mm * 96) / 25.4;
}

const PDF_MARGIN_MM = [20, 10, 20, 10]; // top, right, bottom, left
const PDF_MARGINS_MM = {
  top: PDF_MARGIN_MM[0],
  right: PDF_MARGIN_MM[1],
  bottom: PDF_MARGIN_MM[2],
  left: PDF_MARGIN_MM[3],
};
const A4_PAGE_MM = {
  height: 297,
  width: 210,
};
const PDF_ROW_FRAGMENT_MAX_CHARS = 120;
const PDF_QUOTE_DETAIL_LINES_PER_FRAGMENT = 6;
const PDF_COMPATIBILITY_NAME_MAX_CHARS = 64;
const QUOTE_PDF_TEST_NAMESPACE = "__quotePdfTest";
const QUOTE_PDF_FIXTURE_VERSION = "1";
const QUOTE_PDF_TEST_QUERY_PARAM = "quotePdfTest";

let latestQuotePdfSnapshot = null;

function waitForFontsReady() {
  if (!document.fonts || typeof document.fonts.ready?.then !== "function") {
    return Promise.resolve();
  }

  return document.fonts.ready.catch(() => undefined);
}

function getPdfContentMetrics() {
  return {
    contentHeightPx: mmToPx(
      A4_PAGE_MM.height - PDF_MARGINS_MM.top - PDF_MARGINS_MM.bottom,
    ),
    contentWidthPx: mmToPx(
      A4_PAGE_MM.width - PDF_MARGINS_MM.left - PDF_MARGINS_MM.right,
    ),
  };
}

function splitTextIntoFragments(
  text,
  maxCharsPerFragment = PDF_ROW_FRAGMENT_MAX_CHARS,
) {
  const normalizedText = typeof text === "string" ? text.trim() : "";
  if (!normalizedText) {
    return [];
  }

  const maxChars = Math.max(20, maxCharsPerFragment);
  const words = normalizedText.split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [];
  }

  const fragments = [];
  let currentFragment = "";

  function flushCurrent() {
    if (!currentFragment) {
      return;
    }

    fragments.push(currentFragment);
    currentFragment = "";
  }

  words.forEach((word) => {
    if (word.length > maxChars) {
      flushCurrent();
      for (let index = 0; index < word.length; index += maxChars) {
        fragments.push(word.slice(index, index + maxChars));
      }
      return;
    }

    const candidate = currentFragment ? `${currentFragment} ${word}` : word;
    if (candidate.length <= maxChars) {
      currentFragment = candidate;
      return;
    }

    flushCurrent();
    currentFragment = word;
  });

  flushCurrent();
  return fragments;
}

// =========================================
// Data Layer
// =========================================

function extractCartData() {
  const cartItemNodes = Array.from(document.querySelectorAll(".cart-item"));
  const items = cartItemNodes.map((cartItem) => {
    const titleLink = cartItem.querySelector(".cart-item-title a");
    const itemTitleText = titleLink
      ? titleLink.innerText.trim()
      : cartItem.querySelector(".cart-item-title")?.innerText.trim() || "";

    const optionLines = Array.from(
      cartItem.querySelectorAll(".cart-item-options"),
    )
      .map((option) => option.innerText.trim())
      .filter(Boolean);

    const specLines = [];
    const specDl = cartItem.querySelector(".definitionList");
    if (specDl) {
      specDl.querySelectorAll("dt.definitionList-key").forEach((dt) => {
        const dd = dt.nextElementSibling;
        if (!dd) {
          return;
        }

        const specText =
          `${dt.textContent.trim()} ${dd.textContent.trim()}`.trim();
        if (specText) {
          specLines.push(specText);
        }
      });
    }

    const skuElement = cartItem.querySelector(".cart-item-sku");
    const skuValue = normalizeSkuText(
      skuElement ? skuElement.innerText.trim() : "",
    );

    const priceElement = cartItem.querySelector(
      ".cart-item-block.cart-item-info .cart-item-value",
    );
    const priceText = priceElement ? priceElement.innerText.trim() : "";

    const quantityElement = cartItem.querySelector(
      ".cart-item-block.cart-item-info.cart-item-quantity .form-increment .form-input",
    );
    const quantityText = quantityElement ? quantityElement.value.trim() : "";

    const priceValue = parseFloat(priceText.replace(/[^0-9.-]+/g, "")) || 0;
    const quantityValue = parseInt(quantityText, 10) || 0;
    const lineTotalValue = priceValue * quantityValue;
    const lineTotalText = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
    }).format(lineTotalValue);

    return {
      title: itemTitleText,
      titleHref: titleLink ? titleLink.href : "",
      optionLines,
      specLines,
      optionLineCount: optionLines.length,
      sku: skuValue,
      priceText,
      quantityText,
      lineTotalText,
    };
  });

  const grandTotal = document.querySelector(
    ".cart-total-value.cart-total-grandTotal",
  );
  const grandTotalText = grandTotal ? grandTotal.innerText.trim() : "";

  return {
    items,
    grandTotalText,
  };
}

// =========================================
// Compatibility Data Layer
// =========================================

function normalizeCartItemsForCompatibility(cartItems) {
  const normalizedCartItems = Array.isArray(cartItems)
    ? cartItems
        .map((item) => {
          if (typeof item === "string") {
            return { sku: item, title: "" };
          }

          if (!item || typeof item !== "object") {
            return null;
          }

          return {
            sku: item.sku || "",
            title: item.title || "",
          };
        })
        .filter(Boolean)
    : [];

  const uniqueCartItems = [];
  const seenItemKeys = new Set();
  normalizedCartItems.forEach((item) => {
    const dedupeKey = `${item.sku}::${item.title}`;
    if (seenItemKeys.has(dedupeKey) || (!item.sku && !item.title)) {
      return;
    }

    seenItemKeys.add(dedupeKey);
    uniqueCartItems.push(item);
  });

  return uniqueCartItems;
}

function getCompatibilityStatus(computerData, dockSku) {
  const incompatibleWith = Array.isArray(computerData.incompatibleWith)
    ? computerData.incompatibleWith
    : [];
  const partiallyCompatibleWith = Array.isArray(
    computerData.partiallyCompatibleWith,
  )
    ? computerData.partiallyCompatibleWith
    : [];

  if (incompatibleWith.includes(dockSku)) {
    return { text: "Incompatible", backgroundColor: "#FFDDDD" };
  }

  if (partiallyCompatibleWith.includes(dockSku)) {
    return { text: "Partial", backgroundColor: "#FFF6CC" };
  }

  return { text: "Compatible", backgroundColor: "#DDF5DD" };
}

function getUnmappedCompatibilityItemText(item) {
  const itemTitle = item.title ? item.title.trim() : "";
  const itemSku = item.sku ? item.sku.trim() : "";

  if (itemTitle && itemSku) {
    return `${itemTitle} (SKU: ${itemSku})`;
  }

  if (itemTitle) {
    return itemTitle;
  }

  if (itemSku) {
    return `SKU: ${itemSku}`;
  }

  return "";
}

async function buildCompatibilityData(cartData) {
  const cartItems = normalizeCartItemsForCompatibility(
    (cartData && cartData.items) || [],
  ).map((item) => ({
    sku: item.sku,
    title: item.title,
  }));

  if (!cartItems.length) {
    return null;
  }

  let compatibilityData;
  try {
    const response = await fetch(COMPATIBILITY_DATA_URL);
    if (!response.ok) {
      throw new Error(
        `Compatibility JSON request failed with status ${response.status}`,
      );
    }
    compatibilityData = await response.json();
  } catch (error) {
    console.error("Unable to load compatibility data for quote PDF:", error);
    return null;
  }

  const compatibilityRoot =
    compatibilityData && typeof compatibilityData === "object"
      ? compatibilityData
      : {};
  const computers =
    compatibilityRoot.computers &&
    typeof compatibilityRoot.computers === "object"
      ? compatibilityRoot.computers
      : {};
  const docks =
    compatibilityRoot.docks && typeof compatibilityRoot.docks === "object"
      ? compatibilityRoot.docks
      : {};

  const visibleComputers = Object.keys(computers).reduce((accumulator, sku) => {
    const item = computers[sku];
    if (!item || item.hidden) {
      return accumulator;
    }

    accumulator[sku] = item;
    return accumulator;
  }, {});

  const visibleDocks = Object.keys(docks).reduce((accumulator, sku) => {
    const item = docks[sku];
    if (!item || item.hidden) {
      return accumulator;
    }

    accumulator[sku] = item;
    return accumulator;
  }, {});

  const computerIndexes = buildCompatibilityIndexes(visibleComputers);
  const dockIndexes = buildCompatibilityIndexes(visibleDocks);

  const cartComputers = [];
  const cartDocks = [];
  const seenComputerKeys = new Set();
  const seenDockKeys = new Set();
  const unmappedItems = [];

  cartItems.forEach((item) => {
    const matchedComputerKey = resolveCompatibilityKey(
      item,
      visibleComputers,
      computerIndexes,
    );
    const matchedDockKey = resolveCompatibilityKey(
      item,
      visibleDocks,
      dockIndexes,
    );

    if (matchedComputerKey && !seenComputerKeys.has(matchedComputerKey)) {
      seenComputerKeys.add(matchedComputerKey);
      cartComputers.push(matchedComputerKey);
    }

    if (matchedDockKey && !seenDockKeys.has(matchedDockKey)) {
      seenDockKeys.add(matchedDockKey);
      cartDocks.push(matchedDockKey);
    }

    if (!matchedComputerKey && !matchedDockKey) {
      unmappedItems.push(item);
    }
  });

  if (!cartComputers.length && !cartDocks.length && !unmappedItems.length) {
    return null;
  }

  const matrixAvailable = cartComputers.length > 0 && cartDocks.length > 0;
  const notes = [];
  const matrixTables = [];

  if (matrixAvailable) {
    const MAX_DOCK_COLUMNS_PER_TABLE = 6;
    const dockChunks = chunkArray(cartDocks, MAX_DOCK_COLUMNS_PER_TABLE);

    dockChunks.forEach((dockChunk) => {
      const rows = cartComputers.map((computerSku) => {
        const computerData = visibleComputers[computerSku] || {};

        const cells = dockChunk.map((dockSku) => {
          const status = getCompatibilityStatus(computerData, dockSku);
          const rawNoteText =
            computerData.compatibilityData &&
            computerData.compatibilityData[dockSku] &&
            computerData.compatibilityData[dockSku].notes;
          const noteText =
            typeof rawNoteText === "string" ? rawNoteText.trim() : "";

          let noteIndex = null;
          if (noteText) {
            noteIndex = notes.length + 1;
            notes.push({
              index: noteIndex,
              computerName: computerData.name || computerSku,
              dockName:
                (visibleDocks[dockSku] && visibleDocks[dockSku].name) ||
                dockSku,
              text: noteText,
            });
          }

          return {
            dockSku,
            statusText: status.text,
            backgroundColor: status.backgroundColor,
            noteIndex,
          };
        });

        return {
          computerSku,
          computerName: computerData.name || computerSku,
          cells,
        };
      });

      matrixTables.push({
        dockChunk,
        rows,
      });
    });
  }

  return {
    matrixAvailable,
    matrixTables,
    visibleDocks,
    notes,
    unmappedItems,
  };
}

// =========================================
// Document Model Layer
// =========================================

function splitQuoteRowIfNeeded(rowData) {
  const detailWithKinds = rowData.detailLines.flatMap((line, index) =>
    splitTextIntoFragments(line).map((text) => ({
      text,
      isOptionLine: index < rowData.optionLineCount,
    })),
  );

  if (!detailWithKinds.length) {
    return [
      {
        ...rowData,
        detailLines: [],
        optionLineCount: 0,
      },
    ];
  }

  const rowFragments = [];
  for (
    let index = 0;
    index < detailWithKinds.length;
    index += PDF_QUOTE_DETAIL_LINES_PER_FRAGMENT
  ) {
    const fragmentDetailLines = detailWithKinds.slice(
      index,
      index + PDF_QUOTE_DETAIL_LINES_PER_FRAGMENT,
    );
    const optionLineCount = fragmentDetailLines.filter(
      (line) => line.isOptionLine,
    ).length;

    rowFragments.push({
      title: index === 0 ? rowData.title : `${rowData.title} (continued)`,
      titleHref: index === 0 ? rowData.titleHref : "",
      detailLines: fragmentDetailLines.map((line) => line.text),
      optionLineCount,
      sku: index === 0 ? rowData.sku : "",
      priceText: index === 0 ? rowData.priceText : "",
      quantityText: index === 0 ? rowData.quantityText : "",
      lineTotalText: index === 0 ? rowData.lineTotalText : "",
      compatibilityPayload: rowData.compatibilityPayload,
    });
  }

  return rowFragments;
}

function splitCompatibilityRowIfNeeded(rowData) {
  const nameFragments = splitTextIntoFragments(
    rowData.computerName,
    PDF_COMPATIBILITY_NAME_MAX_CHARS,
  );

  if (nameFragments.length <= 1) {
    return [rowData];
  }

  return nameFragments.map((computerName, index) => ({
    computerSku: rowData.computerSku,
    computerName: index === 0 ? computerName : `${computerName} (continued)`,
    cells:
      index === 0
        ? rowData.cells
        : rowData.cells.map(() => ({
            statusText: "",
            backgroundColor: "#ffffff",
            noteIndex: null,
          })),
  }));
}

function buildQuoteDocumentModel({ cartData, compatibilityData, date }) {
  const today = date instanceof Date ? date : new Date();
  const dateOptions = { year: "numeric", month: "long", day: "numeric" };

  const rawRows = Array.isArray(cartData?.items) ? cartData.items : [];
  const quoteRows = rawRows.flatMap((rowData) =>
    splitQuoteRowIfNeeded({
      title: rowData.title,
      titleHref: rowData.titleHref,
      detailLines: [...rowData.optionLines, ...rowData.specLines],
      optionLineCount: rowData.optionLineCount,
      sku: rowData.sku,
      priceText: rowData.priceText,
      quantityText: rowData.quantityText,
      lineTotalText: rowData.lineTotalText,
      compatibilityPayload: {
        sku: rowData.sku,
        title: rowData.title,
      },
    }),
  );

  const cartItemsForCompatibility = rawRows
    .map((rowData) => ({ sku: rowData.sku, title: rowData.title }))
    .filter((item) => item.sku || item.title);

  const compatibilityModel = compatibilityData
    ? {
        ...compatibilityData,
        matrixTables: compatibilityData.matrixTables.map((tableChunk) => ({
          dockChunk: tableChunk.dockChunk,
          rows: tableChunk.rows.flatMap((row) =>
            splitCompatibilityRowIfNeeded(row),
          ),
        })),
      }
    : null;

  return {
    header: {
      title: "TechHub Quote",
      dateText: today.toLocaleDateString(undefined, dateOptions),
    },
    quoteRows,
    grandTotalText: cartData?.grandTotalText || "",
    footer: {
      disclaimerHtml: `
        <p><strong>Pricing and stock are subject to change.</strong>
        Quote pricing will be honored for 14 days while inventory lasts.</p>
        <p>An approved purchaser can log in to
        <a href="https://techhub.tamu.edu/" class="pdf-link">TechHub</a>
        to complete the purchase. See
        <a href="https://tamu.mybigcommerce.com/terms-and-conditions/" class="pdf-link">Terms and Conditions.</a></p>
      `,
    },
    compatibility: compatibilityModel,
    cartItemsForCompatibility,
  };
}

// =========================================
// Rendering Layer
// =========================================

function injectQuoteStyles() {
  const existing = document.getElementById("quote-pdf-styles");
  if (existing) {
    return;
  }

  const styleTag = document.createElement("style");
  styleTag.id = "quote-pdf-styles";
  styleTag.textContent = `
    .pdf-root { font-family: "Open Sans", sans-serif; width: 190mm; background: #fff; color: #000; }
    .quote-table table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 10px; }
    .quote-table th, .quote-table td { border: 1px solid #000; padding: 8px; font-size: 12px; }
    .quote-table thead { display: table-row-group; }
    .quote-table col.quote-col-item { width: 46%; }
    .quote-table col.quote-col-sku { width: 14%; }
    .quote-table col.quote-col-price { width: 14%; }
    .quote-table col.quote-col-quantity { width: 10%; }
    .quote-table col.quote-col-total { width: 16%; }
    .avoid-break { page-break-inside: avoid; break-inside: avoid; }
    .pdf-page { width: 190mm; min-height: 257mm; padding-bottom: 0; box-sizing: border-box; background: #fff; }
    .pdf-header { margin-bottom: 20px; }
    .pdf-title { font-size: 24px; color: #500000; }
    .pdf-date { font-size: 14px; color: #000; }
    .quote-table th { background: #f2f2f2; text-align: left; overflow-wrap: anywhere; word-break: break-word; }
    .quote-table th.quote-price,
    .quote-table th.quote-quantity,
    .quote-table th.quote-total { text-align: right; }
    .quote-table td { vertical-align: middle; overflow-wrap: anywhere; word-break: break-word; }
    .quote-table .quote-title-cell { text-align: left; }
    .quote-table .quote-sku-cell { text-align: left; }
    .quote-table .quote-price-cell,
    .quote-table .quote-quantity-cell,
    .quote-table .quote-total-cell { text-align: right; }
    .quote-detail-line { font-size: 12px; color: #333; padding-left: 10px; }
    .quote-detail-line.option-line { margin-top: 7px; }
    .quote-detail-line.spec-line { margin-top: 4px; }
    .quote-title-link { border-bottom-color: transparent; color: inherit; text-decoration: none; }
    .grand-total { margin-top: 20px; margin-bottom: 8px; text-align: right; font-weight: bold; }
    .grand-total-label { margin-right: 10px; }
    .pdf-footer { margin-top: 14px; font-size: 12px; line-height: 1.4; color: #000; text-align: center; }
    .pdf-footer p { margin: 0; }
    .pdf-footer p + p { margin-top: 6px; }
    .pdf-footer .pdf-link { font-size: 12px; }
    .compatibility-section { margin-top: 20px; }
    .compatibility-title { margin-top: 16px; margin-bottom: 10px; font-size: 18px; font-weight: 700; color: #222; }
    .compatibility-intro { font-size: 12px; margin-bottom: 10px; color: #333; }
    .compatibility-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 10px; }
    .compatibility-table thead { display: table-row-group; }
    .compatibility-table th { border: 1px solid #000; padding: 6px; font-size: 10.5px; background: #f2f2f2; text-align: center; overflow-wrap: anywhere; word-break: break-word; }
    .compatibility-table th.compatibility-laptop { text-align: left; }
    .compatibility-table td { border: 1px solid #000; padding: 6px; font-size: 10.5px; overflow-wrap: anywhere; word-break: break-word; }
    .compatibility-table td.compatibility-computer { text-align: left; font-weight: 600; }
    .compatibility-cell { text-align: center; vertical-align: middle; color: #1f1f1f; font-weight: 600; }
    .compatibility-cell sup { font-weight: 700; }
    .compatibility-legend { font-size: 11px; color: #333; margin-bottom: 6px; }
    .compatibility-notes-title { font-size: 13px; font-weight: 700; margin-top: 8px; margin-bottom: 5px; }
    .compatibility-note { display: table; table-layout: fixed; width: 100%; margin-bottom: 3px; }
    .compatibility-note-number { display: table-cell; width: 20px; padding-right: 4px; vertical-align: top; font-weight: 600; }
    .compatibility-note-text { display: table-cell; vertical-align: top; }
    .compatibility-unmapped-title { font-size: 11px; font-weight: 700; margin-top: 14px; margin-bottom: 4px; color: #555; }
    .compatibility-unmapped-row { font-size: 11px; color: #555; margin-left: 20px; margin-bottom: 2px; overflow-wrap: anywhere; word-break: break-word; }
    .pdf-exporting { position: fixed; left: 0; top: 0; visibility: visible; z-index: -1; pointer-events: none; display: block !important; background-color: #ffffff !important; color: #000000 !important; opacity: 1; }
  `;
  document.head.appendChild(styleTag);
}

function updatePdfPageSizing(metrics) {
  if (!metrics || typeof metrics.contentWidthPx !== "number") {
    return;
  }

  const existing = document.getElementById("quote-pdf-metrics");
  const styleTag = existing || document.createElement("style");
  styleTag.id = "quote-pdf-metrics";
  styleTag.textContent = `
    .pdf-page { width: ${metrics.contentWidthPx}px; max-width: ${metrics.contentWidthPx}px; }
  `;

  if (!existing) {
    document.head.appendChild(styleTag);
  }
}

function renderQuoteDocument(model) {
  const root = document.createElement("div");
  root.className = "pdf-root";

  const headerContainer = document.createElement("div");
  headerContainer.className = "pdf-header";

  const title = document.createElement("div");
  title.className = "pdf-title";
  title.textContent = model.header.title;
  headerContainer.appendChild(title);

  const date = document.createElement("div");
  date.className = "pdf-date";
  date.textContent = model.header.dateText;
  headerContainer.appendChild(date);

  root.appendChild(headerContainer);

  const quoteTableWrapper = document.createElement("div");
  quoteTableWrapper.className = "quote-table";
  const quoteTable = document.createElement("table");
  quoteTableWrapper.appendChild(quoteTable);

  const columnGroup = document.createElement("colgroup");
  const columnClasses = [
    "quote-col-item",
    "quote-col-sku",
    "quote-col-price",
    "quote-col-quantity",
    "quote-col-total",
  ];
  columnClasses.forEach((className) => {
    const column = document.createElement("col");
    column.className = className;
    columnGroup.appendChild(column);
  });
  quoteTable.appendChild(columnGroup);

  const tableHead = document.createElement("thead");
  const tableBody = document.createElement("tbody");

  const headerRow = document.createElement("tr");
  const itemHeader = document.createElement("th");
  itemHeader.textContent = "Item";
  itemHeader.colSpan = 2;
  headerRow.appendChild(itemHeader);

  const priceHeader = document.createElement("th");
  priceHeader.textContent = "Price";
  priceHeader.className = "quote-price";
  headerRow.appendChild(priceHeader);

  const quantityHeader = document.createElement("th");
  quantityHeader.textContent = "Quantity";
  quantityHeader.className = "quote-quantity";
  headerRow.appendChild(quantityHeader);

  const totalHeader = document.createElement("th");
  totalHeader.textContent = "Total";
  totalHeader.className = "quote-total";
  headerRow.appendChild(totalHeader);

  tableHead.appendChild(headerRow);
  quoteTable.appendChild(tableHead);
  quoteTable.appendChild(tableBody);

  model.quoteRows.forEach((rowData) => {
    const itemRow = document.createElement("tr");
    itemRow.className = "avoid-break";

    const titleCell = document.createElement("td");
    titleCell.className = "quote-title-cell";
    if (rowData.titleHref) {
      const titleAnchor = document.createElement("a");
      titleAnchor.href = rowData.titleHref;
      titleAnchor.textContent = rowData.title;
      titleAnchor.className = "quote-title-link";
      titleCell.appendChild(titleAnchor);
    } else {
      titleCell.textContent = rowData.title;
    }

    rowData.detailLines.forEach((line, index) => {
      const detailLine = document.createElement("div");
      detailLine.textContent = line;
      detailLine.className =
        index < rowData.optionLineCount
          ? "quote-detail-line option-line"
          : "quote-detail-line spec-line";
      titleCell.appendChild(detailLine);
    });

    itemRow.appendChild(titleCell);

    const skuCell = document.createElement("td");
    skuCell.className = "quote-sku-cell";
    skuCell.textContent = rowData.sku;
    itemRow.appendChild(skuCell);

    const priceCell = document.createElement("td");
    priceCell.className = "quote-price-cell";
    priceCell.textContent = rowData.priceText;
    itemRow.appendChild(priceCell);

    const quantityCell = document.createElement("td");
    quantityCell.className = "quote-quantity-cell";
    quantityCell.textContent = rowData.quantityText;
    itemRow.appendChild(quantityCell);

    const totalCell = document.createElement("td");
    totalCell.className = "quote-total-cell";
    totalCell.textContent = rowData.lineTotalText;
    itemRow.appendChild(totalCell);

    tableBody.appendChild(itemRow);
  });

  root.appendChild(quoteTableWrapper);

  if (model.grandTotalText) {
    const grandTotalContainer = document.createElement("div");
    grandTotalContainer.className = "grand-total";

    const grandTotalLabel = document.createElement("span");
    grandTotalLabel.className = "grand-total-label";
    grandTotalLabel.textContent = "Grand Total: ";
    grandTotalContainer.appendChild(grandTotalLabel);

    const grandTotalValue = document.createElement("span");
    grandTotalValue.textContent = model.grandTotalText;
    grandTotalContainer.appendChild(grandTotalValue);

    root.appendChild(grandTotalContainer);
  }

  const footerContainer = document.createElement("div");
  footerContainer.className = "pdf-footer";
  footerContainer.innerHTML = model.footer.disclaimerHtml;
  root.appendChild(footerContainer);

  if (model.compatibility) {
    const compatibilitySection = document.createElement("div");
    compatibilitySection.className = "compatibility-section";

    const matrixHeading = document.createElement("div");
    matrixHeading.className = "compatibility-title";
    matrixHeading.textContent = "Cart Compatibility Matrix";
    compatibilitySection.appendChild(matrixHeading);

    const matrixIntro = document.createElement("div");
    matrixIntro.className = "compatibility-intro";
    matrixIntro.textContent =
      "This section checks only laptops and docks/hubs/monitors currently in this cart.";
    compatibilitySection.appendChild(matrixIntro);

    if (!model.compatibility.matrixAvailable) {
      const matrixUnavailable = document.createElement("div");
      matrixUnavailable.className = "compatibility-unmapped-row";
      matrixUnavailable.textContent =
        "Matrix unavailable: matching laptop and dock/hub/monitor entries were not both found.";
      compatibilitySection.appendChild(matrixUnavailable);
    } else {
      model.compatibility.matrixTables.forEach((tableChunk) => {
        const matrixTable = document.createElement("table");
        matrixTable.className = "compatibility-table";

        const tableHead = document.createElement("thead");
        const tableBody = document.createElement("tbody");
        const headerRow = document.createElement("tr");

        const laptopHeader = document.createElement("th");
        laptopHeader.className = "compatibility-laptop";
        laptopHeader.textContent = "Laptop";
        headerRow.appendChild(laptopHeader);

        tableChunk.dockChunk.forEach((dockSku) => {
          const dockHeader = document.createElement("th");
          const dockData = model.compatibility.visibleDocks[dockSku] || {};
          dockHeader.textContent = dockData.name || dockSku;
          headerRow.appendChild(dockHeader);
        });

        tableHead.appendChild(headerRow);
        matrixTable.appendChild(tableHead);
        matrixTable.appendChild(tableBody);

        tableChunk.rows.forEach((rowData) => {
          const row = document.createElement("tr");
          row.className = "avoid-break";

          const computerCell = document.createElement("td");
          computerCell.className = "compatibility-computer";
          computerCell.textContent = rowData.computerName;
          row.appendChild(computerCell);

          rowData.cells.forEach((cellData) => {
            const compatibilityCell = document.createElement("td");
            compatibilityCell.className = "compatibility-cell";
            compatibilityCell.textContent = cellData.statusText;
            compatibilityCell.style.backgroundColor = cellData.backgroundColor;

            if (cellData.noteIndex) {
              const superscript = document.createElement("sup");
              superscript.textContent = ` ${cellData.noteIndex}`;
              compatibilityCell.appendChild(superscript);
            }

            row.appendChild(compatibilityCell);
          });

          tableBody.appendChild(row);
        });

        compatibilitySection.appendChild(matrixTable);
      });

      const legend = document.createElement("div");
      legend.className = "compatibility-legend";
      legend.textContent =
        "Legend: Compatible (green), Partial (yellow), Incompatible (red).";
      compatibilitySection.appendChild(legend);
    }

    if (model.compatibility.notes.length) {
      const notesHeader = document.createElement("div");
      notesHeader.className = "compatibility-notes-title";
      notesHeader.textContent = "Compatibility Notes";
      compatibilitySection.appendChild(notesHeader);

      model.compatibility.notes.forEach((note) => {
        const noteItem = document.createElement("div");
        noteItem.className = "compatibility-note";

        const noteNumber = document.createElement("span");
        noteNumber.className = "compatibility-note-number";
        noteNumber.textContent = `${note.index}.`;

        const noteContent = document.createElement("span");
        noteContent.className = "compatibility-note-text";
        noteContent.textContent = `${note.computerName} + ${note.dockName}: ${note.text}`;

        noteItem.appendChild(noteNumber);
        noteItem.appendChild(noteContent);
        compatibilitySection.appendChild(noteItem);
      });
    }

    if (model.compatibility.unmappedItems.length) {
      const unmappedHeader = document.createElement("div");
      unmappedHeader.className = "compatibility-unmapped-title";
      unmappedHeader.textContent = "Not included in matrix";
      compatibilitySection.appendChild(unmappedHeader);

      model.compatibility.unmappedItems
        .map((item) => getUnmappedCompatibilityItemText(item))
        .filter(Boolean)
        .forEach((itemText) => {
          const row = document.createElement("div");
          row.className = "compatibility-unmapped-row";
          row.textContent = `- ${itemText}`;
          compatibilitySection.appendChild(row);
        });
    }

    root.appendChild(compatibilitySection);
  }

  return root;
}

// =========================================
// Pagination Layer
// =========================================

function buildQuoteTableChunk(
  wrapperClassName,
  columnClasses,
  headerCells,
  rowNodes,
) {
  const wrapper = document.createElement("div");
  wrapper.className = wrapperClassName;

  const table = document.createElement("table");
  wrapper.appendChild(table);

  const columnGroup = document.createElement("colgroup");
  columnClasses.forEach((className) => {
    const column = document.createElement("col");
    column.className = className;
    columnGroup.appendChild(column);
  });
  table.appendChild(columnGroup);

  const tableHead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerCells.forEach((cell) => {
    const headerCell = document.createElement("th");
    headerCell.textContent = cell.text;
    headerCell.className = cell.className;
    if (cell.colSpan > 1) {
      headerCell.colSpan = cell.colSpan;
    }
    if (cell.rowSpan > 1) {
      headerCell.rowSpan = cell.rowSpan;
    }
    headerRow.appendChild(headerCell);
  });
  tableHead.appendChild(headerRow);
  table.appendChild(tableHead);

  const tableBody = document.createElement("tbody");
  rowNodes.forEach((rowNode) => {
    tableBody.appendChild(rowNode.cloneNode(true));
  });
  table.appendChild(tableBody);

  return wrapper;
}

function parseQuoteTableStructure(quoteTableWrapper) {
  const quoteTable = quoteTableWrapper.querySelector("table");
  const quoteBody = quoteTable?.querySelector("tbody");
  const quoteHeadRow = quoteTable?.querySelector("thead tr");
  const quoteColumnNodes = quoteTable
    ? Array.from(quoteTable.querySelectorAll("colgroup col"))
    : [];
  const quoteRows = quoteBody ? Array.from(quoteBody.children) : [];

  if (!quoteTable || !quoteBody || !quoteHeadRow || !quoteRows.length) {
    return null;
  }

  const columnClasses = quoteColumnNodes.map(
    (columnNode) => columnNode.className,
  );
  const headerCells = Array.from(quoteHeadRow.children).map((cellNode) => ({
    text: cellNode.textContent || "",
    className: cellNode.className,
    colSpan: cellNode.colSpan || 1,
    rowSpan: cellNode.rowSpan || 1,
  }));

  return {
    wrapperClassName: quoteTableWrapper.className,
    columnClasses,
    headerCells,
    rowTemplates: quoteRows,
  };
}

function buildQuoteTableFromStructure(quoteTableStructure, rowNodes) {
  return buildQuoteTableChunk(
    quoteTableStructure.wrapperClassName,
    quoteTableStructure.columnClasses,
    quoteTableStructure.headerCells,
    rowNodes,
  );
}

function buildCompatibilityTableChunk(
  tableAttributes,
  nonBodyChildren,
  rowNodes,
) {
  const chunkTable = document.createElement("table");
  tableAttributes.forEach((attribute) => {
    chunkTable.setAttribute(attribute.name, attribute.value);
  });

  nonBodyChildren.forEach((childNode) => {
    chunkTable.appendChild(childNode.cloneNode(true));
  });

  const chunkBody = document.createElement("tbody");
  rowNodes.forEach((rowNode) => {
    chunkBody.appendChild(rowNode.cloneNode(true));
  });
  chunkTable.appendChild(chunkBody);

  return chunkTable;
}

function parseCompatibilityTableStructure(compatibilityTable) {
  const tableBody = compatibilityTable.querySelector("tbody");
  const tableRows = tableBody ? Array.from(tableBody.children) : [];

  if (!tableBody || !tableRows.length) {
    return null;
  }

  return {
    tableAttributes: Array.from(compatibilityTable.attributes).map(
      (attribute) => ({
        name: attribute.name,
        value: attribute.value,
      }),
    ),
    nonBodyChildren: Array.from(compatibilityTable.children).filter(
      (childNode) => childNode.tagName !== "TBODY",
    ),
    rowTemplates: tableRows,
  };
}

function buildCompatibilityTableFromStructure(
  compatibilityTableStructure,
  rowNodes,
) {
  return buildCompatibilityTableChunk(
    compatibilityTableStructure.tableAttributes,
    compatibilityTableStructure.nonBodyChildren,
    rowNodes,
  );
}

function splitCompatibilitySectionIntoBlocks(compatibilitySection) {
  const sectionChildren = Array.from(compatibilitySection.children);
  if (!sectionChildren.length) {
    return [{ node: compatibilitySection, keepWithNext: false }];
  }

  const blocks = [];
  const headingClasses = new Set([
    "compatibility-title",
    "compatibility-intro",
  ]);
  const introBlock = document.createElement("div");
  introBlock.className = compatibilitySection.className;

  let childIndex = 0;
  while (
    childIndex < sectionChildren.length &&
    headingClasses.has(sectionChildren[childIndex].className)
  ) {
    introBlock.appendChild(sectionChildren[childIndex]);
    childIndex += 1;
  }

  if (introBlock.children.length > 0) {
    blocks.push({ node: introBlock, keepWithNext: true });
  }

  for (; childIndex < sectionChildren.length; childIndex += 1) {
    const childNode = sectionChildren[childIndex];

    if (childNode.classList.contains("compatibility-table")) {
      const parsedCompatibilityTable = parseCompatibilityTableStructure(childNode);
      if (!parsedCompatibilityTable) {
        blocks.push({ node: childNode, keepWithNext: false });
        continue;
      }

      blocks.push({
        keepWithNext: false,
        adaptiveCompatibilityTable: true,
        compatibilityTable: parsedCompatibilityTable,
      });
      continue;
    }

    blocks.push({
      node: childNode,
      keepWithNext:
        childNode.classList.contains("compatibility-notes-title") ||
        childNode.classList.contains("compatibility-unmapped-title"),
    });
  }

  if (!blocks.length) {
    return [{ node: compatibilitySection, keepWithNext: false }];
  }

  return blocks;
}

function buildPaginableBlocks(root) {
  const blocks = [];

  function isAdaptiveTableBlock(block) {
    return Boolean(block.adaptiveQuoteTable || block.adaptiveCompatibilityTable);
  }

  function mergeKeepWithNextBlocks(blockList) {
    const mergedBlocks = [];

    for (let index = 0; index < blockList.length; index += 1) {
      const block = blockList[index];
      if (!block.keepWithNext || index >= blockList.length - 1) {
        mergedBlocks.push(block);
        continue;
      }

      const nextBlock = blockList[index + 1];
      if (isAdaptiveTableBlock(block) || isAdaptiveTableBlock(nextBlock)) {
        mergedBlocks.push(block);
        continue;
      }

      const combinedWrapper = document.createElement("div");
      combinedWrapper.className = "keep-with-next-group";
      combinedWrapper.appendChild(block.node);
      combinedWrapper.appendChild(nextBlock.node);

      mergedBlocks.push({
        node: combinedWrapper,
        keepWithNext: nextBlock.keepWithNext,
      });

      index += 1;
    }

    return mergedBlocks;
  }

  Array.from(root.children).forEach((node) => {
    if (node.classList.contains("pdf-header")) {
      blocks.push({ node, keepWithNext: true });
      return;
    }

    if (node.classList.contains("quote-table")) {
      const parsedQuoteTable = parseQuoteTableStructure(node);
      if (!parsedQuoteTable) {
        blocks.push({ node, keepWithNext: false });
        return;
      }

      blocks.push({
        keepWithNext: false,
        adaptiveQuoteTable: true,
        quoteTable: parsedQuoteTable,
      });
      return;
    }

    if (node.classList.contains("grand-total")) {
      blocks.push({ node, keepWithNext: true });
      return;
    }

    if (node.classList.contains("compatibility-section")) {
      blocks.push(...splitCompatibilitySectionIntoBlocks(node));
      return;
    }

    blocks.push({ node, keepWithNext: false });
  });

  return mergeKeepWithNextBlocks(blocks);
}

function hasMeaningfulText(node) {
  if (!node) {
    return false;
  }

  return Boolean(node.textContent && node.textContent.trim());
}

function hasMeaningfulTableRows(page, tableSelector) {
  if (!page) {
    return false;
  }

  const tableRows = Array.from(page.querySelectorAll(`${tableSelector} tbody tr`));
  return tableRows.some((row) => hasMeaningfulText(row));
}

function hasMeaningfulSelectorText(page, selector) {
  if (!page) {
    return false;
  }

  const matchedNodes = Array.from(page.querySelectorAll(selector));
  return matchedNodes.some((node) => hasMeaningfulText(node));
}

function isMeaningfulPdfPage(page) {
  if (!page) {
    return false;
  }

  const meaningfulTextSelectors = [
    ".pdf-header .pdf-title",
    ".pdf-date",
    ".grand-total",
    ".pdf-footer p",
    ".compatibility-note",
    ".compatibility-unmapped-row",
    ".compatibility-legend",
  ];

  if (hasMeaningfulTableRows(page, ".quote-table")) {
    return true;
  }

  if (hasMeaningfulTableRows(page, ".compatibility-table")) {
    return true;
  }

  return meaningfulTextSelectors.some((selector) =>
    hasMeaningfulSelectorText(page, selector),
  );
}

function paginateDocument(root, metrics) {
  if (!root) {
    throw new Error("Cannot paginate without a root node.");
  }

  updatePdfPageSizing(metrics);

  const pages = [];
  let currentPage = null;
  const pagedRoot = document.createElement("div");
  pagedRoot.id = "pdf-container";
  document.body.appendChild(pagedRoot);

  function isMeaningfulPage(page) {
    return isMeaningfulPdfPage(page);
  }

  function removePageFromState(page) {
    if (!page) {
      return;
    }

    const pageIndex = pages.indexOf(page);
    if (pageIndex !== -1) {
      pages.splice(pageIndex, 1);
    }

    if (page.parentNode) {
      page.remove();
    }
  }

  function ensureCurrentPageIsMounted() {
    if (!currentPage || currentPage.parentNode === pagedRoot) {
      return;
    }

    pagedRoot.appendChild(currentPage);
  }

  function createPage() {
    if (currentPage && !isMeaningfulPage(currentPage)) {
      removePageFromState(currentPage);
      currentPage = pages.length ? pages[pages.length - 1] : null;
    }

    const page = document.createElement("div");
    page.className = "pdf-page";
    currentPage = page;
    pages.push(page);
    return page;
  }

  function appendNode(node) {
    if (!currentPage) {
      createPage();
    }

    ensureCurrentPageIsMounted();

    currentPage.appendChild(node);
  }

  function appendBlockWithOverflowCheck(node) {
    appendNode(node);
    if (!isOverflowing()) {
      return;
    }

    currentPage.removeChild(node);
    createPage();
    appendNode(node);
  }

  function isOverflowing() {
    if (!currentPage) {
      return false;
    }

    return currentPage.scrollHeight > metrics.contentHeightPx;
  }

  function pageHasContent() {
    return Boolean(currentPage && currentPage.children.length > 0);
  }

  function pageHasOnlyQuoteHeader() {
    if (!currentPage || currentPage.children.length !== 1) {
      return false;
    }

    return currentPage.children[0].classList.contains("pdf-header");
  }

  function pageHasOnlyCompatibilityIntro() {
    if (!currentPage || currentPage.children.length !== 1) {
      return false;
    }

    const compatibilitySection = currentPage.children[0];
    if (!compatibilitySection.classList.contains("compatibility-section")) {
      return false;
    }

    const introNodes = Array.from(
      compatibilitySection.querySelectorAll(
        ".compatibility-title, .compatibility-intro",
      ),
    );
    if (!introNodes.length) {
      return false;
    }

    const hasOnlyIntroChildren = Array.from(compatibilitySection.children).every(
      (childNode) =>
        childNode.classList.contains("compatibility-title") ||
        childNode.classList.contains("compatibility-intro"),
    );
    if (!hasOnlyIntroChildren) {
      return false;
    }

    if (
      compatibilitySection.querySelector(".compatibility-table tbody tr") ||
      compatibilitySection.querySelector(".compatibility-note") ||
      compatibilitySection.querySelector(".compatibility-unmapped-row") ||
      compatibilitySection.querySelector(".compatibility-legend")
    ) {
      return false;
    }

    return true;
  }

  function canFitNodeOnCurrentPage(node) {
    appendNode(node);
    const overflowed = isOverflowing();
    currentPage.removeChild(node);
    return !overflowed;
  }

  function measureFittingRowCount(remainingRows, buildChunkNode) {
    let fittingRowCount = 0;

    for (
      let candidateRowCount = 1;
      candidateRowCount <= remainingRows.length;
      candidateRowCount += 1
    ) {
      const candidateChunk = buildChunkNode(
        remainingRows.slice(0, candidateRowCount),
      );
      appendNode(candidateChunk);
      const overflowed = isOverflowing();
      currentPage.removeChild(candidateChunk);

      if (overflowed) {
        break;
      }

      fittingRowCount = candidateRowCount;
    }

    return fittingRowCount;
  }

  function appendAdaptiveTableRows(tableStructure, buildTableNode) {
    if (!tableStructure || !Array.isArray(tableStructure.rowTemplates)) {
      return false;
    }

    const allRows = tableStructure.rowTemplates;
    if (!allRows.length) {
      return false;
    }

    if (!currentPage) {
      createPage();
    }

    let hadPriorPageContent = pageHasContent();
    if (hadPriorPageContent) {
      const fullTableNode = buildTableNode(allRows);
      if (!canFitNodeOnCurrentPage(fullTableNode)) {
        if (!pageHasOnlyQuoteHeader() && !pageHasOnlyCompatibilityIntro()) {
          createPage();
          hadPriorPageContent = false;
        }
      }
    }

    let hasRetriedTinyFirstChunk = false;
    let nextRowStartIndex = 0;

    while (nextRowStartIndex < allRows.length) {
      const remainingRows = allRows.slice(nextRowStartIndex);
      let fittingRowCount = measureFittingRowCount(remainingRows, buildTableNode);

      const canRetryTinyFirstChunk =
        !hasRetriedTinyFirstChunk &&
        hadPriorPageContent &&
        !pageHasOnlyQuoteHeader() &&
        !pageHasOnlyCompatibilityIntro() &&
        fittingRowCount === 1 &&
        remainingRows.length > 1;

      if (canRetryTinyFirstChunk) {
        createPage();
        hadPriorPageContent = false;
        hasRetriedTinyFirstChunk = true;
        continue;
      }

      if (fittingRowCount === 0) {
        const shouldCreateOverflowPage =
          pageHasContent() &&
          !pageHasOnlyQuoteHeader() &&
          !pageHasOnlyCompatibilityIntro();

        if (shouldCreateOverflowPage) {
          createPage();
          hadPriorPageContent = false;
          continue;
        }

        const oversizedChunk = buildTableNode(remainingRows.slice(0, 1));
        appendNode(oversizedChunk);
        nextRowStartIndex += 1;
        hadPriorPageContent = true;

        if (nextRowStartIndex < allRows.length) {
          createPage();
          hadPriorPageContent = false;
        }

        continue;
      }

      const tableChunk = buildTableNode(remainingRows.slice(0, fittingRowCount));
      appendNode(tableChunk);
      nextRowStartIndex += fittingRowCount;
      hadPriorPageContent = true;

      if (nextRowStartIndex < allRows.length) {
        createPage();
        hadPriorPageContent = false;
      }
    }

    return true;
  }

  function appendAdaptiveQuoteTable(block) {
    const quoteTable = block.quoteTable;
    const wasHandled = appendAdaptiveTableRows(quoteTable, (rowNodes) =>
      buildQuoteTableFromStructure(quoteTable, rowNodes),
    );

    if (!wasHandled && block.node) {
      appendBlockWithOverflowCheck(block.node);
    }
  }

  function appendAdaptiveCompatibilityTable(block) {
    const compatibilityTable = block.compatibilityTable;
    const wasHandled = appendAdaptiveTableRows(compatibilityTable, (rowNodes) =>
      buildCompatibilityTableFromStructure(compatibilityTable, rowNodes),
    );

    if (!wasHandled && block.node) {
      appendBlockWithOverflowCheck(block.node);
    }
  }

  const blocks = buildPaginableBlocks(root);
  blocks.forEach((block) => {
    if (block.adaptiveQuoteTable) {
      appendAdaptiveQuoteTable(block);
      return;
    }

    if (block.adaptiveCompatibilityTable) {
      appendAdaptiveCompatibilityTable(block);
      return;
    }

    appendBlockWithOverflowCheck(block.node);
  });

  const renderedPages = Array.from(pagedRoot.querySelectorAll(".pdf-page"));
  for (let pageIndex = renderedPages.length - 1; pageIndex >= 0; pageIndex -= 1) {
    const page = renderedPages[pageIndex];
    if (isMeaningfulPage(page)) {
      break;
    }

    removePageFromState(page);
  }

  if (pagedRoot.parentNode) {
    pagedRoot.remove();
  }

  return pagedRoot;
}

// =========================================
// PDF Export Layer
// =========================================

async function exportPdf(container, opt) {
  if (!container) {
    throw new Error("Cannot export PDF without a container.");
  }

  if (typeof html2pdf !== "function") {
    throw new Error("html2pdf is unavailable for quote PDF export.");
  }

  const exportClassName = "pdf-exporting";
  const hadExportClass = container.classList.contains(exportClassName);
  container.classList.add(exportClassName);

  document.body.appendChild(container);

  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const pageNodes = Array.from(container.querySelectorAll(".pdf-page"));
    const meaningfulPageNodes = pageNodes.filter((pageNode) =>
      isMeaningfulPdfPage(pageNode),
    );
    if (!meaningfulPageNodes.length) {
      throw new Error("No paginated PDF pages were found for export.");
    }

    const marginArray = Array.isArray(opt?.margin) ? opt.margin : PDF_MARGIN_MM;
    const marginTop = Number(marginArray[0]) || 0;
    const marginRight = Number(marginArray[1]) || 0;
    const marginBottom = Number(marginArray[2]) || 0;
    const marginLeft = Number(marginArray[3]) || 0;
    const html2canvasOptions = {
      scale: 1.5,
      ...(opt?.html2canvas || {}),
      scrollX: 0,
      scrollY: 0,
      allowTaint: false,
      useCORS: true,
      backgroundColor: "#ffffff",
    };

    const imageType =
      typeof opt?.image?.type === "string" &&
      opt.image.type.toLowerCase() === "png"
        ? "PNG"
        : "JPEG";
    const imageMimeType = imageType === "PNG" ? "image/png" : "image/jpeg";
    const imageQuality =
      typeof opt?.image?.quality === "number" ? opt.image.quality : 0.98;

    const firstPageNode = meaningfulPageNodes[0];
    const firstCaptureWidth = Math.max(
      1,
      Math.max(firstPageNode.scrollWidth, firstPageNode.offsetWidth),
    );
    const firstCaptureHeight = Math.max(
      1,
      Math.max(firstPageNode.scrollHeight, firstPageNode.offsetHeight),
    );

    const firstPageWorker = html2pdf()
      .from(firstPageNode)
      .set({
        ...opt,
        pagebreak: { mode: [] },
        html2canvas: {
          ...html2canvasOptions,
          width: firstCaptureWidth,
          height: firstCaptureHeight,
          windowWidth: firstCaptureWidth,
          windowHeight: firstCaptureHeight,
        },
      })
      .toPdf();

    const pdf = await firstPageWorker.get("pdf");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const maxRenderWidth = Math.max(1, pageWidth - marginLeft - marginRight);
    const maxRenderHeight = Math.max(1, pageHeight - marginTop - marginBottom);

    for (
      let pageIndex = 1;
      pageIndex < meaningfulPageNodes.length;
      pageIndex += 1
    ) {
      const pageNode = meaningfulPageNodes[pageIndex];
      const captureWidth = Math.max(
        1,
        Math.max(pageNode.scrollWidth, pageNode.offsetWidth),
      );
      const captureHeight = Math.max(
        1,
        Math.max(pageNode.scrollHeight, pageNode.offsetHeight),
      );

      const canvas = await html2pdf()
        .from(pageNode)
        .set({
          html2canvas: {
            ...html2canvasOptions,
            width: captureWidth,
            height: captureHeight,
            windowWidth: captureWidth,
            windowHeight: captureHeight,
          },
          pagebreak: { mode: [] },
        })
        .toCanvas()
        .get("canvas");

      let renderWidth = maxRenderWidth;
      let renderHeight = (canvas.height * renderWidth) / canvas.width;
      if (renderHeight > maxRenderHeight) {
        const scaleFactor = maxRenderHeight / renderHeight;
        renderHeight = maxRenderHeight;
        renderWidth *= scaleFactor;
      }

      pdf.addPage();
      const offsetX = marginLeft;
      const imageData = canvas.toDataURL(imageMimeType, imageQuality);
      pdf.addImage(
        imageData,
        imageType,
        offsetX,
        marginTop,
        renderWidth,
        renderHeight,
      );
    }

    const pageCount = pdf.internal.getNumberOfPages();
    pdf.setFontSize(10);
    pdf.setTextColor(80, 80, 80);

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      pdf.setPage(pageNumber);
      pdf.text(`Page ${pageNumber} of ${pageCount}`, pageWidth / 2, pageHeight - 10, {
        align: "center",
      });
    }

    pdf.save(opt?.filename || "TechHub Quote.pdf");
  } finally {
    if (!hadExportClass) {
      container.classList.remove(exportClassName);
    }
    if (container.parentNode) {
      container.remove();
    }
  }
}

function cloneFixtureData(value) {
  if (value === null || value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function createFixtureSnapshot({ cartData, compatibilityData, model }) {
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "";
  return {
    capturedAt: new Date().toISOString(),
    version: QUOTE_PDF_FIXTURE_VERSION,
    pathname,
    cartData: cloneFixtureData(cartData),
    compatibilityData: cloneFixtureData(compatibilityData),
    model: cloneFixtureData(model),
  };
}

function setLatestFixtureSnapshot(snapshot) {
  latestQuotePdfSnapshot = snapshot ? cloneFixtureData(snapshot) : null;
}

function getLatestFixtureSnapshot() {
  return latestQuotePdfSnapshot
    ? cloneFixtureData(latestQuotePdfSnapshot)
    : null;
}

function buildQuoteExportOptions(model) {
  return {
    margin: PDF_MARGIN_MM,
    filename: `TechHub Quote - ${model.header.dateText}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 1.5,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  };
}

async function renderAndPaginateModel(model) {
  injectQuoteStyles();
  await waitForFontsReady();

  const renderedRoot = renderQuoteDocument(model);
  const paginationMetrics = getPdfContentMetrics();
  return paginateDocument(renderedRoot, paginationMetrics);
}

function buildModelFromFixture(fixture) {
  if (!fixture || typeof fixture !== "object") {
    throw new Error("Fixture must be a non-null object.");
  }

  const cartData =
    fixture.cartData && typeof fixture.cartData === "object"
      ? fixture.cartData
      : { items: [], grandTotalText: "" };
  const compatibilityData = fixture.compatibilityData || null;

  const fixtureDate = fixture.capturedAt
    ? new Date(fixture.capturedAt)
    : new Date();
  const validDate = Number.isNaN(fixtureDate.getTime())
    ? new Date()
    : fixtureDate;

  return {
    cartData,
    compatibilityData,
    model: buildQuoteDocumentModel({
      cartData,
      compatibilityData,
      date: validDate,
    }),
  };
}

function isQuotePdfTestEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  return params.get(QUOTE_PDF_TEST_QUERY_PARAM) === "1";
}

function initializeQuotePdfTestNamespace() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  if (!isQuotePdfTestEnabled()) {
    return;
  }

  const testApi = {
    captureLatest() {
      return getLatestFixtureSnapshot();
    },
    downloadLatestFixture(filename) {
      const snapshot = getLatestFixtureSnapshot();
      if (!snapshot) {
        throw new Error("No quote fixture snapshot is available yet.");
      }

      const fixtureText = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([fixtureText], { type: "application/json" });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const safeFileName =
        typeof filename === "string" && filename.trim()
          ? filename.trim()
          : `quote-fixture-${Date.now()}.json`;

      anchor.href = downloadUrl;
      anchor.download = safeFileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);

      return snapshot;
    },
    async loadFixtureFromObject(fixture) {
      const { cartData, compatibilityData, model } =
        buildModelFromFixture(fixture);
      const snapshot = createFixtureSnapshot({
        cartData,
        compatibilityData,
        model,
      });
      setLatestFixtureSnapshot(snapshot);

      const pagedRoot = await renderAndPaginateModel(model);
      const exportOptions = buildQuoteExportOptions(model);
      await exportPdf(pagedRoot, exportOptions);

      return {
        pageCount: Array.from(pagedRoot.querySelectorAll(".pdf-page")).filter(
          (pageNode) => isMeaningfulPdfPage(pageNode),
        ).length,
        snapshot,
      };
    },
    async previewFixtureFromObject(fixture) {
      const { cartData, compatibilityData, model } =
        buildModelFromFixture(fixture);
      const snapshot = createFixtureSnapshot({
        cartData,
        compatibilityData,
        model,
      });
      setLatestFixtureSnapshot(snapshot);

      const pagedRoot = await renderAndPaginateModel(model);
      document.body.appendChild(pagedRoot);

      return {
        pageCount: Array.from(pagedRoot.querySelectorAll(".pdf-page")).filter(
          (pageNode) => isMeaningfulPdfPage(pageNode),
        ).length,
        container: pagedRoot,
        snapshot,
      };
    },
  };

  window[QUOTE_PDF_TEST_NAMESPACE] = testApi;
}

// =========================================
// Entrypoint
// =========================================

async function generateQuotePdf() {
  const cartData = extractCartData();
  const compatibilityData = await buildCompatibilityData(cartData);
  const model = buildQuoteDocumentModel({
    cartData,
    compatibilityData,
    date: new Date(),
  });
  setLatestFixtureSnapshot(
    createFixtureSnapshot({ cartData, compatibilityData, model }),
  );

  const pagedRoot = await renderAndPaginateModel(model);
  const exportOptions = buildQuoteExportOptions(model);

  await exportPdf(pagedRoot, exportOptions);
}

initializeQuotePdfTestNamespace();

document.addEventListener("click", async function (event) {
  if (event.target && event.target.id === "generate-quote") {
    try {
      await generateQuotePdf();
    } catch (error) {
      console.error("Quote PDF generation failed:", error);
    }
  }

  if (event.target && event.target.id === "send-quote") {
    event.preventDefault();
    console.log("Send Quote button clicked");

    setTimeout(function () {
      window.location.href =
        "https://techhubtest.mybigcommerce.com/send-quote/";
    }, 100);
  }
});
