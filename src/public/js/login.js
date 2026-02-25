// src/public/js/login.js
let authData = {
  phone: '',
  phoneCodeHash: '',
  sessionString: '',
};

function showStep(stepId) {
  document.querySelectorAll('.login-step').forEach(s => s.classList.remove('active'));
  document.getElementById(stepId).classList.add('active');
  hideError();
}

function showError(message) {
  const el = document.getElementById('error-message');
  el.textContent = message;
  el.style.display = 'block';
}

function hideError() {
  document.getElementById('error-message').style.display = 'none';
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  const text = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loading');
  btn.disabled = loading;
  text.style.display = loading ? 'none' : 'inline';
  loader.style.display = loading ? 'inline-flex' : 'none';
}

async function sendCode() {
  const phone = document.getElementById('phone').value.trim();
  if (!phone) {
    showError('Please enter your phone number');
    return;
  }

  setLoading('btn-send-code', true);
  hideError();

  try {
    const res = await fetch('/api/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });

    const data = await res.json();

    if (data.success) {
      authData.phone = phone;
      authData.phoneCodeHash = data.phoneCodeHash;
      authData.sessionString = data.sessionString;
      showStep('step-code');
      document.getElementById('code').focus();
    } else {
      showError(data.error || 'Failed to send code');
    }
  } catch (err) {
    showError('Network error. Please try again.');
    console.error(err);
  } finally {
    setLoading('btn-send-code', false);
  }
}

async function verifyCode() {
  const code = document.getElementById('code').value.trim();
  if (!code) {
    showError('Please enter the verification code');
    return;
  }

  setLoading('btn-verify', true);
  hideError();

  try {
    const res = await fetch('/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        phone: authData.phone,
        code,
        phoneCodeHash: authData.phoneCodeHash,
        sessionString: authData.sessionString,
      }),
    });

    const data = await res.json();

    if (data.success) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/dashboard';
    } else if (data.passwordRequired) {
      showStep('step-password');
      document.getElementById('password').focus();
    } else {
      showError(data.error || 'Verification failed');
    }
  } catch (err) {
    showError('Network error. Please try again.');
    console.error(err);
  } finally {
    setLoading('btn-verify', false);
  }
}

async function submitPassword() {
  const password = document.getElementById('password').value;
  const code = document.getElementById('code').value.trim();

  if (!password) {
    showError('Please enter your 2FA password');
    return;
  }

  setLoading('btn-password', true);
  hideError();

  try {
    const res = await fetch('/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        phone: authData.phone,
        code,
        phoneCodeHash: authData.phoneCodeHash,
        sessionString: authData.sessionString,
        password,
      }),
    });

    const data = await res.json();

    if (data.success) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/dashboard';
    } else {
      showError(data.error || 'Authentication failed');
    }
  } catch (err) {
    showError('Network error. Please try again.');
    console.error(err);
  } finally {
    setLoading('btn-password', false);
  }
}

function goBack() {
  showStep('step-phone');
}

// Check if already logged in
(function checkAuth() {
  const token = localStorage.getItem('token');
  if (token) {
    fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` },
      credentials: 'include',
    })
    .then(r => r.json())
    .then(data => {
      if (data.success) window.location.href = '/dashboard';
    })
    .catch(() => {});
  }
})();

// Enter key support
document.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const phoneStep = document.getElementById('step-phone');
    const codeStep = document.getElementById('step-code');
    const passStep = document.getElementById('step-password');

    if (phoneStep.classList.contains('active')) sendCode();
    else if (codeStep.classList.contains('active')) verifyCode();
    else if (passStep.classList.contains('active')) submitPassword();
  }
});