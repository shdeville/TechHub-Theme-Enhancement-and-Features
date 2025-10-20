
function displayStockNumber() {
    let noSkuCounter = 0; // Counter to track the number of times "No SKU available" occurs
    let intervalId; // Declare the interval ID for global access
    // Fetch the JSON file containing stock levels
    fetch('https://store-jje9unvzjs.mybigcommerce.com/content/Scripts/Testing/filteredResponse.json')
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
                    // Check if the counter has reached 25
                    if (noSkuCounter >= 25) {
                        console.log("No SKU available 25 times. Terminating script.");
                        clearInterval(intervalId); // Stop the interval
                        return;
                    }
                    return;
                }
                const product = getProductData(sku);
                if (!product) {
                    console.error("SKU not found in the JSON file.");
                    return;
                }

                // Always re-grab the button in case Cornerstone re-rendered it
                const addToCartButton = document.querySelector('#form-action-addToCart');

                if (inputElement) {
                    const inputValue = parseInt(inputElement.value, 10) || 0;

                    // === Updated block: compute stockNumber as Qty - bc_status9 - bc_status7 ===
                    const q = parseFloat(product.Qty) || 0;
                    const b9 = parseFloat(product.bc_status9) || 0;
                    const b7 = parseFloat(product.bc_status7) || 0;
                    const stockNumber = q - b9 - b7;
                    // === End update ===

                    const closeOut = product.Closeout === "Y";

                    let message = '';
                    let disableButton = false;

                    // === PATCH START: prioritize closeout, and disable when stock <= 0 OR qty exceeds stock ===
                    if (sku.toUpperCase().includes("SPECIAL")) {
                        // SPECIAL SKUs: informational only
                        message = "Special order items come made-to-order from manufacturers, please expect longer lead times.";
                    } else if (closeOut && (stockNumber < 1 || inputValue > stockNumber)) {
                        const exceededQuantity = Math.max(0, inputValue - stockNumber);
                        message = (stockNumber < 1)
                            ? `This product selection is discontinued and out of stock. <br>We cannot accept orders for this model.`
                            : `You have exceeded quantity in stock by ${exceededQuantity}.<br>We can only accept orders of quantity ${stockNumber} or less for this product. <br> <br>`;
                        disableButton = true;
                    } else if (stockNumber < 1) {
                        // Non-closeout backorder case (button stays enabled)
                        message = "Item is on backorder. Order fulfillment will be delayed.";
                    } else if (inputValue > 9 && !closeOut) {
                        // Bulk order logic for non-closeout items
                        message = `Ordering 10+ items is a bulk order. <a href="https://techhubtest.mybigcommerce.com/faqs/#:~:text=How%20do%20you%20place%20a%20bulk%20order%3F" target="_blank" rel="noopener noreferrer">Click here</a> to learn more. <br><br><br>`;
                    } else if (inputValue > stockNumber) {
                        // Non-closeout exceeded-stock case: partial fulfillment allowed
                        const exceededQuantity = inputValue - stockNumber;
                        message = `You have exceeded our in-stock quantity by ${exceededQuantity}.<br>We will fulfill a portion of your order now, but expect a delay in complete order fulfillment.`;
                    } else {
                        message = `In stock. <br><br><br>`;
                    }
                    // === PATCH END ===

                    // Update the message using the real DOM element
                    updateStockMessageInElement(message);

                    // Handle the Add to Cart button state
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
document.addEventListener('DOMContentLoaded', function () {
    displayStockNumber();
});
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
// Modify the `DOMContentLoaded` event listener to include the updated function
document.addEventListener('DOMContentLoaded', function () {
    displayStockNumber();
    disableTextHighlighting();
    // Call the function to conditionally make the stock field visible
    makeStockFieldVisible();
});

