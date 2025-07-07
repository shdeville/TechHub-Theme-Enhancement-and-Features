// Check if we're on the correct page
if (window.location.href === 'https://techhubtest.mybigcommerce.com/') {
    
    let intervalId = null;
    let isHovered = false;
    let isTabVisible = true;
    const INTERVAL_TIME = 10000; // 10 seconds
    
    // Function to click the carousel right arrow
    function clickCarouselArrow() {
        // Only click if not being hovered and tab is visible
        if (!isHovered && isTabVisible) {
            const arrowButton = document.querySelector('button[data-test-id="carousel-right-arrow"]');
            
            if (arrowButton) {
                arrowButton.click();
                console.log('Carousel arrow clicked');
            } else {
                console.log('Carousel arrow button not found');
            }
        } else {
            if (isHovered) {
                console.log('Carousel auto-advance skipped (user hovering)');
            }
            if (!isTabVisible) {
                console.log('Carousel auto-advance skipped (tab not visible)');
            }
        }
    }
    
    // Function to start the timer
    function startTimer() {
        if (intervalId) {
            clearInterval(intervalId);
        }
        intervalId = setInterval(clickCarouselArrow, INTERVAL_TIME);
        console.log('Timer started/restarted');
    }
    
    // Function to stop the timer
    function stopTimer() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        console.log('Timer stopped');
    }
    
    // Function to handle visibility change
    function handleVisibilityChange() {
        if (document.hidden) {
            isTabVisible = false;
            stopTimer();
            console.log('Tab hidden - timer stopped');
        } else {
            isTabVisible = true;
            if (!isHovered) {
                startTimer();
                console.log('Tab visible - timer restarted');
            }
        }
    }
    
    // Function to set up hover listeners
    function setupHoverListeners() {
        const carouselContainer = document.querySelector('div[data-widget-id="542e44aa-bb7f-409e-ac1c-ac584680dae1"]');
        
        if (carouselContainer) {
            // When mouse enters the carousel area
            carouselContainer.addEventListener('mouseenter', function() {
                isHovered = true;
                stopTimer();
                console.log('Mouse entered carousel - timer stopped and reset');
            });
            
            // When mouse leaves the carousel area
            carouselContainer.addEventListener('mouseleave', function() {
                isHovered = false;
                if (isTabVisible) {
                    startTimer();
                    console.log('Mouse left carousel - timer restarted');
                }
            });
            
            console.log('Hover listeners set up successfully');
            return true;
        } else {
            console.log('Carousel container not found for hover listeners');
            return false;
        }
    }
    
    // Wait for the page to fully load before starting
    window.addEventListener('load', function() {
        // Set up visibility change listener
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Set up hover listeners first
        if (!setupHoverListeners()) {
            // If carousel not found immediately, keep checking
            const checkForCarousel = setInterval(() => {
                if (setupHoverListeners()) {
                    clearInterval(checkForCarousel);
                }
            }, 500);
            
            // Stop checking after 10 seconds
            setTimeout(() => {
                clearInterval(checkForCarousel);
            }, 10000);
        }
        
        // Start the initial timer (only if tab is visible and not hovered)
        if (isTabVisible && !isHovered) {
            startTimer();
        }
        
        // Clean up when navigating away
        window.addEventListener('beforeunload', function() {
            stopTimer();
        });
        
        console.log('Auto-carousel script initialized');
    });
}