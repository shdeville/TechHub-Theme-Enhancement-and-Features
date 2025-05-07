document.addEventListener('DOMContentLoaded', function() {
    // Check if the current page is "/checkout" and exit the script if true
    if (window.location.pathname === '/checkout') {
        return; // Do not run the script on the checkout page
    }

    // Inject the CSS for the dropdown menus
    const style = document.createElement('style');
style.innerHTML = `
    /* General submenu styling */
    .navPage-subMenu {
        background-color: #ffffff !important;
        padding: 0px 0px !important;
        border-radius: 5px !important;
        border: 2px solid #ffffff !important;
        width: auto !important;
        max-width: 300px !important;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2) !important;
        position: absolute;
        top: 100%;
        left: 0;
        display: none !important; /* Hide submenus by default */
        z-index: 1000 !important;
    }

    /* Show submenu when parent has 'menu-active' class (for the Menu button) */
    .navPages-item.menu-active > .navPage-subMenu {
        display: block !important;
    }

    /* Show submenu when parent has 'active' class (for normal nav items) */
    .navPages-item.active > .navPage-subMenu {
        display: block !important;
    }

    .navPage-subMenu-list {
        list-style-type: none !important;
        margin: 0 !important;
        padding: 0 !important;
        display: flex !important;
        flex-direction: column !important;
    }

    .navPage-subMenu-item {
        margin: 0 !important;
        padding: 0 !important;
        list-style-type: none !important;
        text-decoration: none !important;
        text-shadow: none !important;
        width: 100% !important;
    }

    .navPage-subMenu-action {
        color: #000000 !important;
        text-decoration: none !important;
        display: block !important;
        padding: 10px 15px !important;
        border-radius: 3px !important;
        background-color: transparent !important;
        border: none !important;
        position: relative !important;
        z-index: 1 !important;
        width: 100% !important;
        display: flex !important;
        align-items: center !important;
        cursor: pointer !important;
    }

    /* Hover effect for submenu items */
    .navPage-subMenu-action:hover,
    .navPage-subMenu-action:focus,
    .navPage-subMenu-action:active {
        background-color: #ededed !important;
        color: #000000 !important;
        text-decoration: underline !important;
    }

    .navPage-subMenu-action:focus-visible {
        outline: 2px solid black !important;
        outline-offset: 4px !important;
    }

    /* Style for the navigation buttons */
    .navPages-item > .navPages-action {
        color: #000000 !important;
        background-color: transparent !important;
        text-decoration: none !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
    }

    /* Underline on hover */
    .navPages-item > .navPages-action:hover {
        text-decoration: underline !important;
    }

    /* Active state indicator for the "Menu" button when submenu is open */
    .navPages-item.menu-active > .navPages-action {
        background-color: #ededed !important;
        color: #500000 !important;
    }

    /* Active state indicator for normal navigation buttons when submenu is open */
    .navPages-item.active > .navPages-action {
        background-color: #ededed !important;
        color: #500000 !important;
    }

    /* Ensure navigation items are positioned relative */
    .navPages-item {
        position: relative !important;
    }

    /* Hide the "Menu" button by default */
    .navPages-item.left-nav-button {
        display: none;
    }

    /* Style for the SALE button (assuming it's the 7th item) */
    .navPages-list > .navPages-item:nth-child(6) > .navPages-action {
        color: #500000 !important;
        font-weight: 900 !important;
    }
`;
document.head.appendChild(style);


    // Function to remove 'active' class from all normal navigation items
    function removeActiveFromNavItems() {
        document.querySelectorAll('.navPages-item.active').forEach(item => {
            item.classList.remove('active');
            var navAction = item.querySelector('.navPages-action');
            if (navAction) {
                navAction.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Function to handle normal navigation button clicks
    function handleNavButtonClick(event) {
        event.preventDefault();

        const navItem = this.closest('.navPages-item');
        const isActive = navItem.classList.contains('active');

        // Close all submenus
        removeActiveFromNavItems();

        if (!isActive) {
            // Open the clicked submenu
            navItem.classList.add('active');
            this.setAttribute('aria-expanded', 'true');
        }

        // Remove focus from the menu button
        this.blur();
    }

    // Attach event listeners to normal navigation buttons with submenus
    const navActions = document.querySelectorAll('.navPages-item > .navPages-action.has-subMenu');
    navActions.forEach(navAction => {
        // Exclude the "Menu" button
        if (!navAction.closest('.left-nav-button')) {
            navAction.addEventListener('click', handleNavButtonClick);
        }
    });

    // Close normal submenus when clicking outside
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.navPages-item')) {
            removeActiveFromNavItems();
        }
    });

    // Prevent clicks inside normal submenus from closing them
    function preventSubMenuClickPropagation() {
        const subMenus = document.querySelectorAll('.navPage-subMenu');
        subMenus.forEach(subMenu => {
            subMenu.addEventListener('click', function(event) {
                event.stopPropagation();
            });
        });
    }

    // Call the function initially to prevent submenu clicks from closing them
    preventSubMenuClickPropagation();

    // Variables to track the new "Menu" button
    var leftNavButtonCreated = false;
    var leftNavButton;

    // Function to create the "Menu" button
	function createLeftNavButton() {
		if (leftNavButtonCreated) return; // Do nothing if already created

		// Create new menu item
		leftNavButton = document.createElement('li');
		leftNavButton.className = 'navPages-item left-nav-button';

		// Create the anchor element
		var leftNavAnchor = document.createElement('a');
		leftNavAnchor.className = 'navPages-action has-subMenu';
		leftNavAnchor.href = '#';
		leftNavAnchor.textContent = 'Menu'; // You can change the label as needed
		leftNavAnchor.setAttribute('aria-label', 'Menu');

		// Create the icon element and append it to the anchor
		var iconElement = document.createElement('i');
		iconElement.className = 'icon navPages-action-moreIcon';
		iconElement.setAttribute('aria-hidden', 'true');
		iconElement.innerHTML = '<svg><use href="#icon-chevron-down"></use></svg>';

		// Append the icon element to the anchor after the text
		leftNavAnchor.appendChild(iconElement);

		// Append the anchor to the menu item
		leftNavButton.appendChild(leftNavAnchor);

		// Create the submenu div
		var subMenuDiv = document.createElement('div');
		subMenuDiv.className = 'navPage-subMenu';
		subMenuDiv.setAttribute('aria-hidden', 'true');
		subMenuDiv.setAttribute('tabindex', '-1');

		// Create the submenu list
		var subMenuList = document.createElement('ul');
		subMenuList.className = 'navPage-subMenu-list';

		// Clone the left-nav items and append to the submenu
		var leftNavItems = document.querySelectorAll('#left-nav > .navPages-item');

		leftNavItems.forEach(function(item) {
			// Create a new list item for the submenu
			var subMenuItem = document.createElement('li');
			subMenuItem.className = 'navPage-subMenu-item';

			// Get the anchor element from the original item
			var originalLink = item.querySelector('.navPages-action');

			// Create a new anchor element
			var subMenuLink = document.createElement('a');
			subMenuLink.className = 'navPage-subMenu-action';
			subMenuLink.href = originalLink.getAttribute('href');
			subMenuLink.textContent = originalLink.textContent;
			subMenuLink.setAttribute('aria-label', originalLink.getAttribute('aria-label'));

			// Append the new link to the submenu item
			subMenuItem.appendChild(subMenuLink);

			// Append the submenu item to the submenu list
			subMenuList.appendChild(subMenuItem);
		});

		// Append the submenu list to the submenu div
		subMenuDiv.appendChild(subMenuList);

		// Append the submenu div to the menu item
		leftNavButton.appendChild(subMenuDiv);

		// Insert the new menu item into the navigation bar
		var navContainer = document.querySelector('.nav-container');

		// Insert the new menu item before the right-nav
		var rightNav = document.getElementById('right-nav');
		navContainer.insertBefore(leftNavButton, rightNav);

		// Add event listener to the new "Menu" button
		leftNavAnchor.addEventListener('click', function(event) {
			event.preventDefault();

			var isActive = leftNavButton.classList.contains('menu-active');

			// Close any open submenus in the "Menu" button
			leftNavButton.classList.toggle('menu-active', !isActive);
		});

		// Close the "Menu" submenu when clicking outside
		document.addEventListener('click', function(event) {
			if (!leftNavButton.contains(event.target)) {
				leftNavButton.classList.remove('menu-active');
			}
		});

		// Prevent clicks inside submenu from closing it
		subMenuDiv.addEventListener('click', function(event) {
			event.stopPropagation();
		});

		leftNavButtonCreated = true;
	}


    // Function to remove the "Menu" button
    function removeLeftNavButton() {
        if (!leftNavButtonCreated) return; // Do nothing if not created

        // Remove the "Menu" button from the DOM
        leftNavButton.parentNode.removeChild(leftNavButton);

        leftNavButtonCreated = false;
    }

    // Function to update menu visibility based on window width
    function updateMenuVisibility() {
        var width = window.innerWidth;
        var leftNav = document.getElementById('left-nav');
        if (width >= 800 && width < 1425) {
            leftNav.style.display = 'none';

            createLeftNavButton();

            // Show the new "Menu" button
            if (leftNavButton) {
                leftNavButton.style.display = 'block';
            }
        } else {
            leftNav.style.display = '';

            // Hide or remove the new "Menu" button
            if (leftNavButton) {
                leftNavButton.style.display = 'none';
            }
            removeLeftNavButton();
        }
    }

    // Call the function initially to set the correct state on page load
    updateMenuVisibility();

    // Add event listener for window resize to update the menu visibility dynamically
    window.addEventListener('resize', updateMenuVisibility);

    // Close submenus when scrolling
    window.addEventListener('scroll', function() {
        // Close the "Menu" submenu
        if (leftNavButton) {
            leftNavButton.classList.remove('menu-active');
        }

        // Close normal navigation submenus
        removeActiveFromNavItems();
    });

    // Modify the "Cart" button behavior to link directly to the cart page (optional)
    var cartLink = document.querySelector('.navUser-item--cart .navUser-action');

    if (cartLink) {
        // Remove attributes that trigger the minicart
        cartLink.removeAttribute('data-cart-preview');
        cartLink.removeAttribute('data-dropdown');
        cartLink.removeAttribute('data-options');
        cartLink.removeAttribute('aria-expanded');

        // Remove event listeners that might open the minicart
        cartLink.addEventListener('click', function(event) {
            // Stop any other click events from firing
            event.stopPropagation();

            // Ensure the default link behavior occurs (navigate to cart page)
            // If the default behavior is being prevented elsewhere, you can force navigation:
            // window.location.href = cartLink.href;
        });
    }
});