/* The enquiry form. Posts to Netlify Forms in the background so the
   person never leaves the page, then swaps the form for "Sent". */
(function () {
  var form = document.querySelector('form[name="enquiry"]');
  if (!form) return;

  var sent = document.getElementById('sent');
  var err = document.getElementById('form-error');
  var button = form.querySelector('button[type="submit"]');

  function fail(message) {
    err.textContent = message;
    err.hidden = false;
    button.disabled = false;
    button.textContent = 'Send';
  }

  form.addEventListener('submit', function (event) {
    // The browser checks 'required' first. If it is off, or the page is opened
    // without JavaScript, the form posts to Netlify the ordinary way.
    if (!window.fetch || !window.FormData || !window.URLSearchParams) return;

    event.preventDefault();
    err.hidden = true;

    var name = form.elements['name'].value.trim();
    // The subject line of the email Anna gets: who it is from.
    if (form.elements['subject']) form.elements['subject'].value = 'Enquiry from ' + (name || 'the website');
    var phone = form.elements['phone'].value.trim();
    if (!name || !phone) {
      fail('Please put in your name and a phone number so Anna can call you back.');
      (name ? form.elements['phone'] : form.elements['name']).focus();
      return;
    }

    button.disabled = true;
    button.textContent = 'Sending…';

    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(form)).toString()
    })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        form.hidden = true;
        sent.hidden = false;
        sent.setAttribute('tabindex', '-1');
        sent.focus();
        sent.scrollIntoView({ block: 'center' });
      })
      .catch(function () {
        fail('That did not go through. Please ring Anna on 0433 353 612.');
      });
  });
})();
