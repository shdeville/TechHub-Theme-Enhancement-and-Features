// Function to set a cookie
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

document.addEventListener('click', function(event) {
    if (event.target && event.target.id === 'generate-quote') {
        console.log("Generate Quote button clicked");

        // Create the header container
        const headerContainer = document.createElement('div');
        headerContainer.style.marginBottom = '20px';
        headerContainer.style.fontFamily = 'Open Sans, sans-serif';

        // Create the title
        const title = document.createElement('div');
        title.textContent = 'TechHub Quote';
        title.style.fontSize = '24px'; // Adjust size as needed
        title.style.color = '#500000';
        headerContainer.appendChild(title);

        // Create the date
        const date = document.createElement('div');
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        date.textContent = today.toLocaleDateString(undefined, options);
        date.style.fontSize = '14px'; // Smaller size than the title
        date.style.color = '#000000';
        headerContainer.appendChild(date);

        // Create a table for the PDF content
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';

        // Add table headers
        const headerRow = document.createElement('tr');
        
        // Header for Item (spanning two columns)
        const itemHeader = document.createElement('th');
        itemHeader.textContent = 'Item';
        itemHeader.style.border = '1px solid #000';
        itemHeader.style.padding = '8px';
        itemHeader.style.textAlign = 'left';
        itemHeader.style.backgroundColor = '#f2f2f2';
        itemHeader.colSpan = 2; // Ensure this spans two columns (for title and SKU)
        headerRow.appendChild(itemHeader);

        // Header for Price
        const priceHeader = document.createElement('th');
        priceHeader.textContent = 'Price';
        priceHeader.style.border = '1px solid #000';
        priceHeader.style.padding = '8px';
        priceHeader.style.textAlign = 'right';
        priceHeader.style.backgroundColor = '#f2f2f2';
        headerRow.appendChild(priceHeader);

        // Header for Quantity
        const quantityHeader = document.createElement('th');
        quantityHeader.textContent = 'Quantity';
        quantityHeader.style.border = '1px solid #000';
        quantityHeader.style.padding = '8px';
        quantityHeader.style.textAlign = 'right';
        quantityHeader.style.backgroundColor = '#f2f2f2';
        headerRow.appendChild(quantityHeader);

        // Header for Total
        const totalHeader = document.createElement('th');
        totalHeader.textContent = 'Total';
        totalHeader.style.border = '1px solid #000';
        totalHeader.style.padding = '8px';
        totalHeader.style.textAlign = 'right';
        totalHeader.style.backgroundColor = '#f2f2f2';
        headerRow.appendChild(totalHeader);

        // Append the header row to the table
        table.appendChild(headerRow);

        // Add item details
        const items = document.querySelectorAll('.cart-item');
        items.forEach(item => {
            const itemRow = document.createElement('tr');

            // Get the title and URL
            const titleLink = item.querySelector('.cart-item-title a');
            const titleCell = document.createElement('td');
            titleCell.style.border = '1px solid #000';
            titleCell.style.padding = '8px';
            titleCell.style.textAlign = 'left';
            titleCell.colSpan = 1; // Spans two columns for title and SKU

            // Title content
            if (titleLink) {
                const titleAnchor = document.createElement('a');
                titleAnchor.href = titleLink.href;
                titleAnchor.textContent = titleLink.innerText.trim();
                titleAnchor.style.borderBottomColor = 'transparent'; // Remove underline
                titleCell.appendChild(titleAnchor);
            } else {
                titleCell.textContent = item.querySelector('.cart-item-title')?.innerText.trim() || '';
            }

            // Get all the options (if present) and append each one
            const options = item.querySelectorAll('.cart-item-options');
            options.forEach(option => {
                const optionsDiv = document.createElement('div');
                optionsDiv.textContent = option.innerText.trim();
                optionsDiv.style.fontSize = '12px';
                optionsDiv.style.color = '#333';
                optionsDiv.style.marginTop = '7px';
                optionsDiv.style.paddingLeft = '10px';
                titleCell.appendChild(optionsDiv);
            });

            // Get detailed specs from the definitionList (CPU, GPU, RAM, Storage)
            const specDl = item.querySelector('.definitionList');
            if (specDl) {
                specDl.querySelectorAll('dt.definitionList-key').forEach(dt => {
                    const dd = dt.nextElementSibling;
                    if (!dd) return;
                    const specDiv = document.createElement('div');
                    specDiv.style.fontSize = '12px';
                    specDiv.style.color = '#333';
                    specDiv.style.marginTop = '4px';
                    specDiv.style.paddingLeft = '10px';
                    specDiv.textContent = `${dt.textContent.trim()} ${dd.textContent.trim()}`;
                    titleCell.appendChild(specDiv);
                });
            }

            // Add titleCell (with options & specs) to the row
            itemRow.appendChild(titleCell);

            // Get the SKU
            const sku = item.querySelector('.cart-item-sku');
            const skuCell = document.createElement('td');
            skuCell.textContent = sku ? sku.innerText.trim() : '';
            skuCell.style.border = '1px solid #000';
            skuCell.style.padding = '8px';
            skuCell.style.textAlign = 'left';
            skuCell.style.verticalAlign = 'middle';
            itemRow.appendChild(skuCell);

            // Get the price
            const price = item.querySelector('.cart-item-block.cart-item-info .cart-item-value');
            const priceCell = document.createElement('td');
            priceCell.textContent = price ? price.innerText.trim() : '';
            priceCell.style.border = '1px solid #000';
            priceCell.style.padding = '8px';
            priceCell.style.textAlign = 'right';
            priceCell.style.verticalAlign = 'middle';
            itemRow.appendChild(priceCell);

            // Get the quantity
            const quantity = item.querySelector('.cart-item-block.cart-item-info.cart-item-quantity .form-increment .form-input');
            const quantityCell = document.createElement('td');
            quantityCell.textContent = quantity ? quantity.value.trim() : '';
            quantityCell.style.border = '1px solid #000';
            quantityCell.style.padding = '8px';
            quantityCell.style.textAlign = 'right';
            quantityCell.style.verticalAlign = 'middle';
            itemRow.appendChild(quantityCell);

            // Calculate the line total from price and quantity
            const priceText    = priceCell.textContent;              
            const quantityText = quantityCell.textContent;           
            const priceValue   = parseFloat(priceText.replace(/[^0-9.-]+/g, '')) || 0;
            const quantityValue= parseInt(quantityText, 10)           || 0;
            const lineTotal    = priceValue * quantityValue;
            const totalFormatted = new Intl.NumberFormat(undefined, {
                style:    'currency',
                currency: 'USD'
            }).format(lineTotal);

            // Build and append the Total cell
            const totalCell = document.createElement('td');
            totalCell.textContent = totalFormatted;
            totalCell.style.border = '1px solid #000';
            totalCell.style.padding = '8px';
            totalCell.style.textAlign = 'right';
            totalCell.style.verticalAlign = 'middle';
            itemRow.appendChild(totalCell);

            table.appendChild(itemRow);
        });

        // Append the table to a container
        const container = document.createElement('div');
        container.id = 'pdf-container';
        container.appendChild(headerContainer);
        container.appendChild(table);

        // Add grand total separately
        const grandTotal = document.querySelector('.cart-total-value.cart-total-grandTotal');
        if (grandTotal) {
            const grandTotalContainer = document.createElement('div');
            grandTotalContainer.style.marginTop = '20px';
            grandTotalContainer.style.textAlign = 'right';
            grandTotalContainer.style.fontWeight = 'bold';

            const grandTotalLabel = document.createElement('span');
            grandTotalLabel.textContent = 'Grand Total: ';
            grandTotalLabel.style.marginRight = '10px';
            grandTotalContainer.appendChild(grandTotalLabel);

            const grandTotalValue = document.createElement('span');
            grandTotalValue.textContent = grandTotal.innerText.trim();
            grandTotalContainer.appendChild(grandTotalValue);

            container.appendChild(grandTotalContainer);
        }

        // Create the footer container
        const footerContainer = document.createElement('div');
        footerContainer.style.marginTop = '20px';
        footerContainer.style.fontFamily = 'Open Sans, sans-serif';
        footerContainer.style.fontSize = '12px';
        footerContainer.style.color = '#000000';
        footerContainer.style.textAlign = 'center';

        const disclaimer = document.createElement('div');
        disclaimer.innerHTML = 
            '<p><strong>Pricing and stock are subject to change.</strong> ' +
            'Quote pricing will be honored for 14 days while inventory lasts.</p>' +
            '<p>An approved purchaser can log in to ' +
            '<a href="https://techhub.tamu.edu/" style="font-size: 12px;">TechHub</a> ' +
            'to complete the purchase. See ' +
            '<a href="https://tamu.mybigcommerce.com/terms-and-conditions/" ' +
            'style="font-size: 12px;">Terms and Conditions.</a></p>';
        footerContainer.appendChild(disclaimer);
        container.appendChild(footerContainer);

        // Options for generating the PDF
        const opt = {
            margin: [20, 10, 20, 10], // top, right, bottom, left
            filename: `TechHub Quote - ${today.toLocaleDateString(undefined, options)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: 'avoid-all' }
        };

        // Generate the PDF
        html2pdf().from(container).set(opt).toPdf().get('pdf').then(function (pdf) {
            const totalPages = pdf.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);
                pdf.setFontSize(10);
                pdf.setTextColor(150);
                pdf.text(
                    `Page ${i} of ${totalPages}`,
                    pdf.internal.pageSize.getWidth() - 20,
                    pdf.internal.pageSize.getHeight() - 10
                );
            }
        }).save();
    }

    // Send Quote functionality
    if (event.target && event.target.id === 'send-quote') {
        event.preventDefault();
        console.log("Send Quote button clicked");

        // Your logic for sending the quote goes here...

        // Navigate to the specified URL in the same tab
        setTimeout(function() {
            window.location.href = 'https://techhubtest.mybigcommerce.com/send-quote/';
        }, 100);
    }
});
