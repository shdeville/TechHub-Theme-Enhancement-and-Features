(function() {
    document.addEventListener('DOMContentLoaded', function() {
        // Select the main image container
        const mainImageContainer = document.querySelector('.productView-image');
        if (!mainImageContainer) return;

        // Get all thumbnail anchor elements
        const thumbnails = document.querySelectorAll('.productView-thumbnails .productView-thumbnail-link');
        if (!thumbnails || thumbnails.length === 0) return;

        // Check if there's only one thumbnail, hide the arrows if true
        if (thumbnails.length <= 1) return;

        // Create a container for the arrows
        const arrowsContainer = document.createElement('div');
        arrowsContainer.classList.add('arrows-container');

        // Create left and right arrow elements
        const leftArrow = document.createElement('div');
        const rightArrow = document.createElement('div');
        leftArrow.innerHTML = '&#10094;'; // Left arrow symbol
        rightArrow.innerHTML = '&#10095;'; // Right arrow symbol
        leftArrow.classList.add('custom-arrow', 'left-arrow');
        rightArrow.classList.add('custom-arrow', 'right-arrow');
        arrowsContainer.appendChild(leftArrow);
        arrowsContainer.appendChild(rightArrow);
        mainImageContainer.parentNode.insertBefore(arrowsContainer, mainImageContainer.nextSibling);

        // Get main image element and its parent anchor
        const mainImage = document.querySelector('.productView-img-container img');
        const mainImageAnchor = document.querySelector('.productView-img-container a');
        if (!mainImage || !mainImageAnchor) return;

        // Set transition for fade effect on the main image
        mainImage.style.transition = 'opacity 0.2s ease';
        mainImage.style.opacity = 1;

        // Flag to prevent rapid clicks
        let isTransitioning = false;

        // Preload images from thumbnails (optional)
        function preloadImage(url) {
            if (!url) return;
            const img = new Image();
            img.src = url;
        }
        thumbnails.forEach(thumb => {
            const imageUrl = thumb.getAttribute('data-image-gallery-new-image-url');
            preloadImage(imageUrl);
        });

        // Get the index of the currently active thumbnail
        function getCurrentIndex() {
            for (let i = 0; i < thumbnails.length; i++) {
                if (thumbnails[i].classList.contains('is-active')) {
                    return i;
                }
            }
            return 0;
        }

        // Function to update the main image with a fade effect
        function updateMainImage(index) {
            if (isTransitioning) return;
            isTransitioning = true;

            // Update active thumbnail classes
            thumbnails.forEach(thumb => thumb.classList.remove('is-active'));
            thumbnails[index].classList.add('is-active');

            // Retrieve new image data
            const newImageUrl = thumbnails[index].getAttribute('data-image-gallery-new-image-url');
            const newImageSrcset = thumbnails[index].getAttribute('data-image-gallery-new-image-srcset');
            const newZoomImageUrl = thumbnails[index].getAttribute('data-image-gallery-zoom-image-url');
            if (!newImageUrl) {
                isTransitioning = false;
                return;
            }

            // Duration for fade out (in milliseconds)
            const fadeDuration = 200;
            // Fade out the current image
            mainImage.style.opacity = 0;

            // Once the new image loads, fade it in and allow further clicks
            mainImage.addEventListener('load', function handler() {
                mainImage.style.opacity = 1;
                isTransitioning = false;
            }, { once: true });

            // Wait for the fade-out to begin then update the image source
            setTimeout(function() {
                mainImage.src = newImageUrl;
                if (newImageSrcset) {
                    mainImage.srcset = newImageSrcset;
                    mainImage.setAttribute('data-srcset', newImageSrcset);
                }
                mainImageAnchor.href = newZoomImageUrl || newImageUrl;

                // Optional: Trigger lazy loading if used on your site
                if (typeof window.lazySizes !== 'undefined') {
                    window.lazySizes.loader.unveil(mainImage);
                }
                // Optional: Re-initialize zoom plugin if necessary
                if (typeof $(mainImage).data('elevateZoom') !== 'undefined') {
                    $(mainImage).data('elevateZoom').swaptheimage(newImageUrl, newZoomImageUrl || newImageUrl);
                }
            }, fadeDuration);
        }

        // Event listeners for the arrows with debounce
        leftArrow.addEventListener('click', function(event) {
            event.stopPropagation();
            const currentIndex = getCurrentIndex();
            const newIndex = (currentIndex - 1 + thumbnails.length) % thumbnails.length;
            updateMainImage(newIndex);
        });

        rightArrow.addEventListener('click', function(event) {
            event.stopPropagation();
            const currentIndex = getCurrentIndex();
            const newIndex = (currentIndex + 1) % thumbnails.length;
            updateMainImage(newIndex);
        });

        // Additional CSS styling for the arrows
        const style = document.createElement('style');
        style.innerHTML = `
            .arrows-container {
                display: flex;
                justify-content: center;
                margin-top: 10px;
            }
            .custom-arrow {
                cursor: pointer;
                font-size: 2em;
                color: #000;
                background: rgba(255, 255, 255, 0.5);
                padding: 0.3em;
                border-radius: 50%;
                user-select: none;
                margin: 0 50px;
                transition: all 0.2s ease;
            }
            .custom-arrow:hover {
                color: rgba(180, 180, 180);
            }
            .custom-arrow:active {
                background: rgba(255, 255, 255, 1);
            }
        `;
        document.head.appendChild(style);
    });
})();
