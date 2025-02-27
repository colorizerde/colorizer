document.getElementById('forgotPasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value;

  const response = await fetch('/account/forgot-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email })
  });

  const result = await response.json();

  if (response.ok) {
    alert('Password reset link sent to your email');
  } else {
    alert(result.message);
  }
});