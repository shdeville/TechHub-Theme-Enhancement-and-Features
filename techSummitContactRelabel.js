
(function () {
  // Lock to ONLY the Tech Summit contact form page
  // Handles trailing slashes and query strings.
  var path = (window.location && window.location.pathname) ? window.location.pathname.replace(/\/+$/, '') : '';
  if (path !== '/tech-summit-contact-form') return;

  var replacements = [
    {
      selector: 'label.form-label[for="contact_companyname"]',
      newText: 'System Member Name'
    },
    {
      // If you know the exact "for" value for the comments field, replace this with it.
      selector: 'label.form-label',
      matchText: /comments\s*\/\s*questions/i,
      newText: 'Onboarding Request/Questions'
    }
  ];

  function applyReplacements() {
    var updated = 0;

    replacements.forEach(function (r) {
      if (r.matchText) {
        var labels = document.querySelectorAll(r.selector);
        for (var i = 0; i < labels.length; i++) {
          var lbl = labels[i];
          var t = (lbl.textContent || '').trim();
          if (r.matchText.test(t)) {
            lbl.textContent = r.newText;
            updated++;
            break;
          }
        }
      } else {
        var lblExact = document.querySelector(r.selector);
        if (lblExact) {
          lblExact.textContent = r.newText;
          updated++;
        }
      }
    });

    return updated >= 2;
  }

  function run() {
    if (applyReplacements()) observer.disconnect();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

  // Watch for late-rendered form markup
  var observer = new MutationObserver(function () {
    if (applyReplacements()) observer.disconnect();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
