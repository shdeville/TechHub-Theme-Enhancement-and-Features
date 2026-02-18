//Staging Version
const COMPATIBILITY_DATA_URL =
  "https://store-jsj7fos9p1.mybigcommerce.com/content/JSON%20Files/Compatibility.json";

// Function to set a cookie
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

function appendUnmappedCompatibilityItems(container, unmappedItems) {
  if (!unmappedItems.length) {
    return;
  }

  const unmappedHeader = document.createElement("div");
  unmappedHeader.textContent = "Not included in matrix";
  unmappedHeader.style.fontSize = "11px";
  unmappedHeader.style.fontWeight = "700";
  unmappedHeader.style.marginTop = "8px";
  unmappedHeader.style.marginBottom = "4px";
  unmappedHeader.style.color = "#555";
  container.appendChild(unmappedHeader);

  const unmappedList = document.createElement("ul");
  unmappedList.style.margin = "0 0 0 16px";
  unmappedList.style.padding = "0";
  unmappedList.style.fontSize = "11px";
  unmappedList.style.color = "#555";

  unmappedItems.forEach((item) => {
    const unmappedItem = document.createElement("li");
    const itemTitle = item.title ? item.title.trim() : "";
    const itemSku = item.sku ? item.sku.trim() : "";

    if (itemTitle && itemSku) {
      unmappedItem.textContent = `${itemTitle} (SKU: ${itemSku})`;
    } else if (itemTitle) {
      unmappedItem.textContent = itemTitle;
    } else if (itemSku) {
      unmappedItem.textContent = `SKU: ${itemSku}`;
    }

    if (unmappedItem.textContent) {
      unmappedList.appendChild(unmappedItem);
    }
  });

  if (unmappedList.children.length) {
    container.appendChild(unmappedList);
  }
}

function createCompatibilityCell(cell, statusText, backgroundColor) {
  cell.textContent = statusText;
  cell.style.backgroundColor = backgroundColor;
  cell.style.color = "#1f1f1f";
  cell.style.fontWeight = "600";
  cell.style.textAlign = "center";
  cell.style.verticalAlign = "middle";
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

async function appendCartCompatibilityMatrix(container, cartItems) {
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
    if (seenItemKeys.has(dedupeKey)) {
      return;
    }

    if (!item.sku && !item.title) {
      return;
    }

    seenItemKeys.add(dedupeKey);
    uniqueCartItems.push(item);
  });

  if (!uniqueCartItems.length) return;

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
    return;
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

  uniqueCartItems.forEach((item) => {
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
    return;
  }

  const matrixHeading = document.createElement("div");
  matrixHeading.textContent = "Cart Compatibility Matrix";
  matrixHeading.style.marginTop = "24px";
  matrixHeading.style.marginBottom = "10px";
  matrixHeading.style.fontSize = "18px";
  matrixHeading.style.fontWeight = "700";
  matrixHeading.style.color = "#222";
  container.appendChild(matrixHeading);

  const matrixIntro = document.createElement("div");
  matrixIntro.textContent =
    "This section checks only laptops and docks/hubs/monitors currently in this cart.";
  matrixIntro.style.fontSize = "12px";
  matrixIntro.style.marginBottom = "10px";
  matrixIntro.style.color = "#333";
  container.appendChild(matrixIntro);

  if (!cartComputers.length || !cartDocks.length) {
    const matrixUnavailable = document.createElement("div");
    matrixUnavailable.textContent =
      "Matrix unavailable: matching laptop and dock/hub/monitor entries were not both found.";
    matrixUnavailable.style.fontSize = "11px";
    matrixUnavailable.style.color = "#555";
    matrixUnavailable.style.marginBottom = "8px";
    container.appendChild(matrixUnavailable);
    appendUnmappedCompatibilityItems(container, unmappedItems);
    return;
  }

  const MAX_DOCK_COLUMNS_PER_TABLE = 6;
  const MAX_COMPUTER_ROWS_PER_TABLE = 14;
  const dockChunks = chunkArray(cartDocks, MAX_DOCK_COLUMNS_PER_TABLE);
  const computerChunks = chunkArray(cartComputers, MAX_COMPUTER_ROWS_PER_TABLE);
  const notes = [];

  dockChunks.forEach((dockChunk) => {
    computerChunks.forEach((computerChunk) => {
      const matrixTable = document.createElement("table");
      matrixTable.style.width = "100%";
      matrixTable.style.borderCollapse = "collapse";
      matrixTable.style.marginBottom = "10px";

      const headerRow = document.createElement("tr");
      const laptopHeader = document.createElement("th");
      laptopHeader.textContent = "Laptop";
      laptopHeader.style.border = "1px solid #000";
      laptopHeader.style.padding = "6px";
      laptopHeader.style.fontSize = "10.5px";
      laptopHeader.style.backgroundColor = "#f2f2f2";
      laptopHeader.style.textAlign = "left";
      headerRow.appendChild(laptopHeader);

      dockChunk.forEach((dockSku) => {
        const dockHeader = document.createElement("th");
        const dockData = docks[dockSku] || {};
        dockHeader.textContent = dockData.name || dockSku;
        dockHeader.style.border = "1px solid #000";
        dockHeader.style.padding = "6px";
        dockHeader.style.fontSize = "10.5px";
        dockHeader.style.backgroundColor = "#f2f2f2";
        dockHeader.style.textAlign = "center";
        headerRow.appendChild(dockHeader);
      });

      matrixTable.appendChild(headerRow);

      computerChunk.forEach((computerSku) => {
        const computerData = computers[computerSku] || {};
        const row = document.createElement("tr");

        const computerCell = document.createElement("td");
        computerCell.textContent = computerData.name || computerSku;
        computerCell.style.border = "1px solid #000";
        computerCell.style.padding = "6px";
        computerCell.style.fontSize = "10.5px";
        computerCell.style.textAlign = "left";
        computerCell.style.fontWeight = "600";
        row.appendChild(computerCell);

        dockChunk.forEach((dockSku) => {
          const compatibilityCell = document.createElement("td");
          compatibilityCell.style.border = "1px solid #000";
          compatibilityCell.style.padding = "6px";
          compatibilityCell.style.fontSize = "10.5px";

          const incompatibleWith = Array.isArray(computerData.incompatibleWith)
            ? computerData.incompatibleWith
            : [];
          const partiallyCompatibleWith = Array.isArray(
            computerData.partiallyCompatibleWith,
          )
            ? computerData.partiallyCompatibleWith
            : [];

          if (incompatibleWith.includes(dockSku)) {
            createCompatibilityCell(compatibilityCell, "Incompatible", "#FFDDDD");
          } else if (partiallyCompatibleWith.includes(dockSku)) {
            createCompatibilityCell(compatibilityCell, "Partial", "#FFF6CC");
          } else {
            createCompatibilityCell(compatibilityCell, "Compatible", "#DDF5DD");
          }

          const rawNoteText =
            computerData.compatibilityData &&
            computerData.compatibilityData[dockSku] &&
            computerData.compatibilityData[dockSku].notes;
          const noteText =
            typeof rawNoteText === "string" ? rawNoteText.trim() : "";

          if (noteText) {
            const noteIndex = notes.length + 1;
            notes.push({
              index: noteIndex,
              computerName: computerData.name || computerSku,
              dockName: (docks[dockSku] && docks[dockSku].name) || dockSku,
              text: noteText,
            });

            const superscript = document.createElement("sup");
            superscript.textContent = ` ${noteIndex}`;
            superscript.style.fontWeight = "700";
            compatibilityCell.appendChild(superscript);
          }

          row.appendChild(compatibilityCell);
        });

        matrixTable.appendChild(row);
      });

      container.appendChild(matrixTable);
    });
  });

  const legend = document.createElement("div");
  legend.style.fontSize = "11px";
  legend.style.color = "#333";
  legend.style.marginBottom = "6px";
  legend.textContent =
    "Legend: Compatible (green), Partial (yellow), Incompatible (red).";
  container.appendChild(legend);

  if (notes.length) {
    const notesHeader = document.createElement("div");
    notesHeader.textContent = "Compatibility Notes";
    notesHeader.style.fontSize = "13px";
    notesHeader.style.fontWeight = "700";
    notesHeader.style.marginTop = "8px";
    notesHeader.style.marginBottom = "5px";
    container.appendChild(notesHeader);

    const notesList = document.createElement("ol");
    notesList.style.margin = "0 0 0 18px";
    notesList.style.padding = "0";
    notesList.style.fontSize = "11px";
    notesList.style.color = "#333";

    notes.forEach((note) => {
      const noteItem = document.createElement("li");
      noteItem.textContent = `${note.computerName} + ${note.dockName}: ${note.text}`;
      noteItem.style.marginBottom = "4px";
      notesList.appendChild(noteItem);
    });

    container.appendChild(notesList);
  }

  appendUnmappedCompatibilityItems(container, unmappedItems);
}

document.addEventListener("click", async function (event) {
  if (event.target && event.target.id === "generate-quote") {
    console.log("Generate Quote button clicked");

    // Create the header container
    const headerContainer = document.createElement("div");
    headerContainer.style.marginBottom = "20px";
    headerContainer.style.fontFamily = "Open Sans, sans-serif";

    // Create the title
    const title = document.createElement("div");
    title.textContent = "TechHub Quote";
    title.style.fontSize = "24px"; // Adjust size as needed
    title.style.color = "#500000";
    headerContainer.appendChild(title);

    // Create the date
    const date = document.createElement("div");
    const today = new Date();
    const options = { year: "numeric", month: "long", day: "numeric" };
    date.textContent = today.toLocaleDateString(undefined, options);
    date.style.fontSize = "14px"; // Smaller size than the title
    date.style.color = "#000000";
    headerContainer.appendChild(date);

    // Create a table for the PDF content
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";

    // Add table headers
    const headerRow = document.createElement("tr");

    // Header for Item (spanning two columns)
    const itemHeader = document.createElement("th");
    itemHeader.textContent = "Item";
    itemHeader.style.border = "1px solid #000";
    itemHeader.style.padding = "8px";
    itemHeader.style.textAlign = "left";
    itemHeader.style.backgroundColor = "#f2f2f2";
    itemHeader.colSpan = 2; // Ensure this spans two columns (for title and SKU)
    headerRow.appendChild(itemHeader);

    // Header for Price
    const priceHeader = document.createElement("th");
    priceHeader.textContent = "Price";
    priceHeader.style.border = "1px solid #000";
    priceHeader.style.padding = "8px";
    priceHeader.style.textAlign = "right";
    priceHeader.style.backgroundColor = "#f2f2f2";
    headerRow.appendChild(priceHeader);

    // Header for Quantity
    const quantityHeader = document.createElement("th");
    quantityHeader.textContent = "Quantity";
    quantityHeader.style.border = "1px solid #000";
    quantityHeader.style.padding = "8px";
    quantityHeader.style.textAlign = "right";
    quantityHeader.style.backgroundColor = "#f2f2f2";
    headerRow.appendChild(quantityHeader);

    // Header for Total
    const totalHeader = document.createElement("th");
    totalHeader.textContent = "Total";
    totalHeader.style.border = "1px solid #000";
    totalHeader.style.padding = "8px";
    totalHeader.style.textAlign = "right";
    totalHeader.style.backgroundColor = "#f2f2f2";
    headerRow.appendChild(totalHeader);

    // Append the header row to the table
    table.appendChild(headerRow);

    // Add item details
    const items = document.querySelectorAll(".cart-item");
    const cartItemsForCompatibility = [];
    items.forEach((item) => {
      const itemRow = document.createElement("tr");

      // Get the title and URL
      const titleLink = item.querySelector(".cart-item-title a");
      const itemTitleText = titleLink
        ? titleLink.innerText.trim()
        : item.querySelector(".cart-item-title")?.innerText.trim() || "";
      const titleCell = document.createElement("td");
      titleCell.style.border = "1px solid #000";
      titleCell.style.padding = "8px";
      titleCell.style.textAlign = "left";
      titleCell.colSpan = 1; // Spans two columns for title and SKU

      // Title content
      if (titleLink) {
        const titleAnchor = document.createElement("a");
        titleAnchor.href = titleLink.href;
        titleAnchor.textContent = itemTitleText;
        titleAnchor.style.borderBottomColor = "transparent"; // Remove underline
        titleCell.appendChild(titleAnchor);
      } else {
        titleCell.textContent = itemTitleText;
      }

      // Get all the options (if present) and append each one
      const options = item.querySelectorAll(".cart-item-options");
      options.forEach((option) => {
        const optionsDiv = document.createElement("div");
        optionsDiv.textContent = option.innerText.trim();
        optionsDiv.style.fontSize = "12px";
        optionsDiv.style.color = "#333";
        optionsDiv.style.marginTop = "7px";
        optionsDiv.style.paddingLeft = "10px";
        titleCell.appendChild(optionsDiv);
      });

      // Get detailed specs from the definitionList (CPU, GPU, RAM, Storage)
      const specDl = item.querySelector(".definitionList");
      if (specDl) {
        specDl.querySelectorAll("dt.definitionList-key").forEach((dt) => {
          const dd = dt.nextElementSibling;
          if (!dd) return;
          const specDiv = document.createElement("div");
          specDiv.style.fontSize = "12px";
          specDiv.style.color = "#333";
          specDiv.style.marginTop = "4px";
          specDiv.style.paddingLeft = "10px";
          specDiv.textContent = `${dt.textContent.trim()} ${dd.textContent.trim()}`;
          titleCell.appendChild(specDiv);
        });
      }

      // Add titleCell (with options & specs) to the row
      itemRow.appendChild(titleCell);

      // Get the SKU
      const sku = item.querySelector(".cart-item-sku");
      const skuCell = document.createElement("td");
      const skuValue = normalizeSkuText(sku ? sku.innerText.trim() : "");
      skuCell.textContent = skuValue;
      skuCell.style.border = "1px solid #000";
      skuCell.style.padding = "8px";
      skuCell.style.textAlign = "left";
      skuCell.style.verticalAlign = "middle";
      itemRow.appendChild(skuCell);
      if (skuValue || itemTitleText) {
        cartItemsForCompatibility.push({
          sku: skuValue,
          title: itemTitleText,
        });
      }

      // Get the price
      const price = item.querySelector(
        ".cart-item-block.cart-item-info .cart-item-value",
      );
      const priceCell = document.createElement("td");
      priceCell.textContent = price ? price.innerText.trim() : "";
      priceCell.style.border = "1px solid #000";
      priceCell.style.padding = "8px";
      priceCell.style.textAlign = "right";
      priceCell.style.verticalAlign = "middle";
      itemRow.appendChild(priceCell);

      // Get the quantity
      const quantity = item.querySelector(
        ".cart-item-block.cart-item-info.cart-item-quantity .form-increment .form-input",
      );
      const quantityCell = document.createElement("td");
      quantityCell.textContent = quantity ? quantity.value.trim() : "";
      quantityCell.style.border = "1px solid #000";
      quantityCell.style.padding = "8px";
      quantityCell.style.textAlign = "right";
      quantityCell.style.verticalAlign = "middle";
      itemRow.appendChild(quantityCell);

      // Calculate the line total from price and quantity
      const priceText = priceCell.textContent;
      const quantityText = quantityCell.textContent;
      const priceValue = parseFloat(priceText.replace(/[^0-9.-]+/g, "")) || 0;
      const quantityValue = parseInt(quantityText, 10) || 0;
      const lineTotal = priceValue * quantityValue;
      const totalFormatted = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
      }).format(lineTotal);

      // Build and append the Total cell
      const totalCell = document.createElement("td");
      totalCell.textContent = totalFormatted;
      totalCell.style.border = "1px solid #000";
      totalCell.style.padding = "8px";
      totalCell.style.textAlign = "right";
      totalCell.style.verticalAlign = "middle";
      itemRow.appendChild(totalCell);

      table.appendChild(itemRow);
    });

    // Append the table to a container
    const container = document.createElement("div");
    container.id = "pdf-container";
    container.appendChild(headerContainer);
    container.appendChild(table);

    // Add grand total separately
    const grandTotal = document.querySelector(
      ".cart-total-value.cart-total-grandTotal",
    );
    if (grandTotal) {
      const grandTotalContainer = document.createElement("div");
      grandTotalContainer.style.marginTop = "20px";
      grandTotalContainer.style.textAlign = "right";
      grandTotalContainer.style.fontWeight = "bold";

      const grandTotalLabel = document.createElement("span");
      grandTotalLabel.textContent = "Grand Total: ";
      grandTotalLabel.style.marginRight = "10px";
      grandTotalContainer.appendChild(grandTotalLabel);

      const grandTotalValue = document.createElement("span");
      grandTotalValue.textContent = grandTotal.innerText.trim();
      grandTotalContainer.appendChild(grandTotalValue);

      container.appendChild(grandTotalContainer);
    }

    // Create the footer container
    const footerContainer = document.createElement("div");
    footerContainer.style.marginTop = "20px";
    footerContainer.style.fontFamily = "Open Sans, sans-serif";
    footerContainer.style.fontSize = "12px";
    footerContainer.style.color = "#000000";
    footerContainer.style.textAlign = "center";

    const disclaimer = document.createElement("div");
    disclaimer.innerHTML =
      "<p><strong>Pricing and stock are subject to change.</strong> " +
      "Quote pricing will be honored for 14 days while inventory lasts.</p>" +
      "<p>An approved purchaser can log in to " +
      '<a href="https://techhub.tamu.edu/" style="font-size: 12px;">TechHub</a> ' +
      "to complete the purchase. See " +
      '<a href="https://tamu.mybigcommerce.com/terms-and-conditions/" ' +
      'style="font-size: 12px;">Terms and Conditions.</a></p>';
    footerContainer.appendChild(disclaimer);
    container.appendChild(footerContainer);

    const compatibilitySection = document.createElement("div");
    compatibilitySection.style.pageBreakBefore = "always";
    compatibilitySection.style.breakBefore = "page";
    await appendCartCompatibilityMatrix(
      compatibilitySection,
      cartItemsForCompatibility,
    );
    if (compatibilitySection.children.length) {
      container.appendChild(compatibilitySection);
    }

    // Options for generating the PDF
    const opt = {
      margin: [20, 10, 20, 10], // top, right, bottom, left
      filename: `TechHub Quote - ${today.toLocaleDateString(undefined, options)}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    };

    // Generate the PDF
    html2pdf()
      .from(container)
      .set(opt)
      .toPdf()
      .get("pdf")
      .then(function (pdf) {
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(10);
          pdf.setTextColor(150);
          pdf.text(
            `Page ${i} of ${totalPages}`,
            pdf.internal.pageSize.getWidth() - 20,
            pdf.internal.pageSize.getHeight() - 10,
          );
        }
      })
      .save();
  }

  // Send Quote functionality
  if (event.target && event.target.id === "send-quote") {
    event.preventDefault();
    console.log("Send Quote button clicked");

    // Your logic for sending the quote goes here...

    // Navigate to the specified URL in the same tab
    setTimeout(function () {
      window.location.href =
        "https://techhubtest.mybigcommerce.com/send-quote/";
    }, 100);
  }
});
