document.addEventListener('DOMContentLoaded', function() {
    function extractUrlFromNode(node) {
        if (!node) return null;
        const a = node.querySelector('a[href^="http"]');
        if (a && a.href) return a.href.trim();
        const text = (node.textContent || node.innerText || '').trim();
        const match = text.match(/https?:\/\/[^\s<>"')]+/);
        return match ? match[0] : null;
    }

    const warrantyTabLink = document.querySelector('a.tab-title[href="#tab-warranty"]');
    if (!warrantyTabLink) return;

    const warrantyContent = document.getElementById('tab-warranty');
    if (!warrantyContent) return;

    const url = extractUrlFromNode(warrantyContent);

    // Remove any pre-existing banner with the same id (avoid duplicates)
    const existingBanner = document.getElementById('model-message');
    if (existingBanner && existingBanner.parentElement) {
        existingBanner.parentElement.removeChild(existingBanner);
    }

    // Build the banner
    const banner = document.createElement('div');
    banner.id = 'model-message';
    banner.className = 'model-message-hide-mobile';
    banner.setAttribute('style',
        'background-color: #fbf6e9; border: 3px solid #deb349; border-radius: 6px; ' +
        'padding: 12px; display: flex; align-items: center; justify-content: center; ' +
        'margin-bottom: 16px; scroll-margin-top: 150px;'
    );

    const bannerP = document.createElement('p');
    bannerP.setAttribute('style', 'margin: 0; line-height: 1.4;');

    // Sentence 1 (always shown)
    const s1 = document.createTextNode(
        '3D model may not accurately represent sold product (ex. included ports). '
    );
    bannerP.appendChild(s1);

    // Sentence 2: with link if URL exists, else a plain notice
    if (url) {
        const s2a = document.createTextNode('Full 3D model may be viewed ');
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'here';
        const period = document.createTextNode('.');

        bannerP.append(s2a, link, period);
    } else {
        const s2 = document.createTextNode('Full 3D model is not available for this product. [CHECK PRODUCT SETTINGS]');
        bannerP.appendChild(s2);
    }

    banner.appendChild(bannerP);

    // Replace tab content with the banner (and iframe only if we have a URL)
    warrantyContent.innerHTML = '';
    warrantyContent.appendChild(banner);

    if (url) {
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.style.width = '100%';
        iframe.style.height = '600px'; // your current size
        iframe.style.border = 'none';
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allowfullscreen', 'true');
        warrantyContent.appendChild(iframe);
    }
});
