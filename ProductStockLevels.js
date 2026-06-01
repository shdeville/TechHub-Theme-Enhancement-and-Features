// prod version
function displayStockNumber() {
    let noSkuCounter = 0; // Counter to track the number of times "No SKU available" occurs
    let intervalId; // Declare the interval ID for global access

    // Fetch the JSON file containing stock levels
    fetch('https://store-jsj7fos9p1.mybigcommerce.com/content/JSON%20Files/filteredResponse.json')
        .then(response => response.json())
        .then(data => {
            // Function to get the current SKU
            function getCurrentSKU() {
                const skuElement = document.querySelector(
                    '#main-content > div.container > div > div.productView > section.productView-details.product-data > div > dl:nth-child(1) > dd'
                );
                return skuElement ? skuElement.textContent.trim() : null;
            }

            // Function to get product data based on SKU
            function getProductData(sku) {
                return data.find(p => p.sku === sku);
            }

            // Function to update the stock message using a real DOM element
            function updateStockMessageInElement(message) {
                const incrementField = document.querySelector('.form-increment[data-quantity-change]');
                if (!incrementField) {
                    console.error("Increment field not found.");
                    return;
                }

                // Check if the message div already exists
                let messageDiv = document.getElementById('dynamic-increment-message');
                if (!messageDiv) {
                    messageDiv = document.createElement('div');
                    messageDiv.id = 'dynamic-increment-message';

                    // Style the message div
                    messageDiv.style.fontFamily = '"Work Sans", sans-serif';
                    messageDiv.style.fontSize = '15px';
                    messageDiv.style.fontWeight = 'bold';
                    messageDiv.style.color = 'black';
                    messageDiv.style.marginTop = '15px';
                    messageDiv.style.textAlign = 'left';

                    // Append the message div after the increment field
                    incrementField.parentNode.insertBefore(messageDiv, incrementField.nextSibling);
                }

                // Update the content of the message div
                messageDiv.innerHTML = message;

                // Add hover event listeners to pause/resume updates
                const link = messageDiv.querySelector('a');
                if (link) {
                    link.addEventListener('mouseenter', pauseUpdating);
                    link.addEventListener('mouseleave', resumeUpdating);
                }
            }

            const inputElement = document.querySelector('#qty\\[\\]');

            function checkAndUpdateInputValue() {
                const sku = getCurrentSKU();
                if (!sku) {
                    noSkuCounter++;
                    console.log("No SKU available, not displaying stock message.");
                    if (noSkuCounter >= 25) {
                        console.log("No SKU available 25 times. Terminating script.");
                        clearInterval(intervalId);
                        return;
                    }
                    return;
                }

                const product = getProductData(sku);
                if (!product) {
                    console.error("SKU not found in the JSON file.");
                    return;
                }

                const addToCartButton = document.querySelector('#form-action-addToCart');

                if (inputElement) {
                    const inputValue = parseInt(inputElement.value, 10) || 0;

                    // Raw values from filteredResponse.json
                    const q = parseFloat(product.Qty) || 0;
                    const po = parseFloat(product.quantityOnPurchaseOrder) || 0;
                    const b9 = parseFloat(product.bc_status9) || 0;
                    const b7 = parseFloat(product.bc_status7) || 0;

                    // Physical quantity available right now, after subtracting already-committed BC quantities.
                    // This is used for customer messaging so closeout items do not incorrectly appear simply "In stock"
                    // when the purchasable quantity is actually coming from quantityOnPurchaseOrder.
                    const physicalStockNumberRaw = q - b9 - b7;
                    const physicalStockNumber = Math.max(0, physicalStockNumberRaw);

                    // Total customer-purchasable quantity, including incoming purchase orders.
                    // This preserves the original effective availability logic.
                    const stockNumber = physicalStockNumberRaw + po;

                    const closeOut = String(product.Closeout || '').toUpperCase() === "Y";

                    const unitLabel = (amount) => Math.abs(amount) === 1 ? 'unit' : 'units';

                    let message = '';
                    let disableButton = false;

                    if (sku.toUpperCase().includes("SPECIAL")) {
                        message = "Special order items come made-to-order from manufacturers, please expect longer lead times.";
                    } else if (closeOut) {
                        if (stockNumber < 1) {
                            message = `This product selection is discontinued and out of stock. <br>We cannot accept orders for this model.`;
                            disableButton = true;
                        } else if (inputValue > stockNumber) {
                            const exceededQuantity = Math.max(0, inputValue - stockNumber);
                            message = `You have exceeded quantity in stock by ${exceededQuantity}.<br><a href="https://service.tamu.edu/TDClient/36/Portal/Requests/TicketRequests/NewForm?ID=KN84p4nVmJQ_&RequestorType=ServiceOffering" target="_blank" rel="noopener noreferrer">Click here</a> to contact our team about placing a larger order.<br>`;
                            disableButton = true;
                        } else if (inputValue > physicalStockNumber) {
                            const exceededOnHandQuantity = Math.max(0, inputValue - physicalStockNumber);
                            message = `You have selected ${exceededOnHandQuantity} more ${unitLabel(exceededOnHandQuantity)} than we currently have physically in stock.<br> Additional inventory is on order but fulfillment may be delayed.<br>`;
                        } else {
                            message = `In stock. <br><br>`;
                        }
                    } else if (stockNumber < 1) {
                        message = "Item is on backorder. Order fulfillment will be delayed.";
                    } else if (inputValue > 9) {
                        message = `Ordering 10+ items is a bulk order, please expect delays in fulfillment.<br><a href="https://tamu.mybigcommerce.com/faqs/#:~:text=How%20do%20you%20place%20a%20bulk%20order%3F" target="_blank" rel="noopener noreferrer">Click here</a> to learn more. <br><br>`;
                    } else if (inputValue > stockNumber) {
                        const exceededQuantity = inputValue - stockNumber;
                        message = `You have exceeded our in-stock quantity by ${exceededQuantity}.<br>We will fulfill a portion of your order now. Expect a delay in complete fulfillment.`;
                    } else {
                        message = `In stock. <br><br><br>`;
                    }

                    updateStockMessageInElement(message);

                    if (addToCartButton && disableButton) {
                        addToCartButton.disabled = true;
                        addToCartButton.style.backgroundColor = 'grey';
                        addToCartButton.style.cursor = 'not-allowed';
                    } else if (addToCartButton) {
                        addToCartButton.disabled = false;
                        addToCartButton.style.backgroundColor = '';
                        addToCartButton.style.cursor = '';
                    }
                }
            }

            // Pause updating the message
            function pauseUpdating() {
                clearInterval(intervalId);
                console.log("Paused updates.");
            }

            // Resume updating the message
            function resumeUpdating() {
                intervalId = setInterval(checkAndUpdateInputValue, 50);
                console.log("Resumed updates.");
            }

            // Initialize the interval for updates
            intervalId = setInterval(checkAndUpdateInputValue, 50);

            // Function to handle the initial and updated SKUs
            function handleSKUChange() {
                checkAndUpdateInputValue();
            }

            // Initialize with the first SKU check
            handleSKUChange();

            // Create a MutationObserver to watch for changes in the SKU element
            const skuElement = document.querySelector(
                '#main-content > div.container > div > div.productView > section.productView-details.product-data > div > dl:nth-child(1) > dd'
            );
            if (skuElement) {
                const observer = new MutationObserver(handleSKUChange);
                observer.observe(skuElement, { childList: true, subtree: true });
            }
        })
        .catch(error => {
            console.error('Error fetching the JSON file:', error);
        });
}

// Function to disable text highlighting
function disableTextHighlighting() {
    const addToCartButton = document.querySelector('#form-action-addToCart');
    if (!addToCartButton) {
        console.error("Add to Cart button not found.");
        return;
    }

    function disableHighlighting() {
        document.body.style.userSelect = 'none';
        setTimeout(() => {
            document.body.style.userSelect = '';
        }, 5000);
    }

    addToCartButton.addEventListener('click', disableHighlighting);
}

function makeStockFieldVisible() {
    const stockField = document.querySelector('.form-field.form-field--stock');
    if (stockField) {
        // Locate the span containing the stock value
        const stockSpan = stockField.querySelector('span[data-product-stock]');
        if (stockSpan) {
            const stockValue = parseInt(stockSpan.textContent.trim(), 10); // Parse the stock value as an integer
            if (stockValue > 10) {
                console.log(`Stock is ${stockValue}, greater than 10. Keeping the element hidden.`);
                return; // Do nothing if stock is above 10
            }
            console.log(`Stock is ${stockValue}, 10 or below. Making the element visible.`);
            stockField.style.display = 'block'; // Ensure the element is displayed
            stockField.style.visibility = 'visible'; // Make the element visible
        } else {
            console.error("Stock span element not found.");
        }
    } else {
        console.error("Stock field element not found.");
    }
}

// Run all front-end stock behaviors once the page is ready.
// Note: the original pasted script called displayStockNumber() in two DOMContentLoaded listeners.
// This version consolidates that into one listener so the stock-check interval does not run twice.
document.addEventListener('DOMContentLoaded', function () {
    displayStockNumber();
    disableTextHighlighting();
    makeStockFieldVisible();
});