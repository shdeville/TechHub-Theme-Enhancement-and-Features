# TechHub-Theme-Enhancement-and-Features
Various scripts and files for enhancing the TechHub custom cornerstone theme

## cornerstoneHeaderMenuFocus.js
This script customizes the header navigation behavior for BigCommerce's Cornerstone theme. It hides the first navigation item and dynamically injects a responsive "Menu" button that consolidates other menu items on medium-width screens. It also adds keyboard and click interaction logic to open and close submenus while ensuring accessibility and visual consistency. Additionally, it modifies the cart button to bypass the minicart and link directly to the cart page.

## product_Image_Selector_Override.js
This script enhances the product image gallery on the product detail page by adding custom left and right arrow controls. It allows users to cycle through product thumbnails and smoothly updates the main image with a fade transition. The script also preloads all thumbnail images for better performance and maintains support for zoom and lazy loading if those features are present. Custom styles are injected to visually format the arrows and hover effects.

## ProductStockLevels.js
This script fetches stock data from an external JSON file and uses it to display real-time stock messages based on the current SKU and quantity input. It warns users when they've exceeded available inventory or are placing bulk orders and disables the "Add to Cart" button when necessary, especially for closeout items. It monitors SKU changes dynamically and updates the message accordingly, while also conditionally revealing hidden stock elements when inventory is low. It includes a feature to prevent accidental text highlighting and adds stability through interval checks and mutation observers.

## quote_builder.js
This script generates a downloadable PDF quote from the items currently in the user's shopping cart. When triggered, it creates a styled layout with item details, prices, quantities, totals, and disclaimers, using the html2pdf library to export it. It includes item options and technical specs when available, and appends a footer with pricing terms and links. A secondary action allows users to "send" the quote, redirecting them to a specified page after a short delay.
