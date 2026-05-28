const config = window.DEVCAMP_CONFIG || {};
const form = document.getElementById('lookupForm');
const button = document.getElementById('submitButton');
const message = document.getElementById('message');
const result = document.getElementById('result');
const fields = {
  taskNo: document.getElementById('taskNo'),
  projectName: document.getElementById('projectName'),
  teamName: document.getElementById('teamName'),
  folderLink: document.getElementById('folderLink')
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setLoading(true);
  clearResult();

  const email = form.email.value.trim();
  const phoneLast4 = form.phoneLast4.value.replace(/\D/g, '').slice(0, 4);

  if (!config.lookupEndpoint || config.lookupEndpoint.includes('YOUR_SUPABASE')) {
    setLoading(false);
    showMessage('조회 API가 아직 연결되지 않았습니다. 운영사무국에 문의해주세요.', 'error');
    return;
  }

  try {
    const response = await fetch(config.lookupEndpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ email, phoneLast4 })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error((data && data.message) || '조회 요청에 실패했습니다.');
    }

    handleSuccess(data);
  } catch (error) {
    handleFailure(error);
  }
});

form.phoneLast4.addEventListener('input', (event) => {
  event.target.value = event.target.value.replace(/\D/g, '').slice(0, 4);
});

function handleSuccess(response) {
  setLoading(false);

  if (!response || !response.ok) {
    showMessage((response && response.message) || '조회에 실패했습니다.', 'error');
    return;
  }

  fields.taskNo.textContent = response.taskNo || '';
  fields.projectName.textContent = response.projectName || '';
  fields.teamName.textContent = response.teamName || '';
  fields.folderLink.href = response.folderUrl;

  showMessage(response.message || '조회가 완료되었습니다.', 'success');
  result.classList.add('active');
}

function handleFailure(error) {
  setLoading(false);
  showMessage(error && error.message ? error.message : '일시적인 오류가 발생했습니다.', 'error');
}

function setLoading(isLoading) {
  button.disabled = isLoading;
  button.textContent = isLoading ? '조회 중...' : '폴더 링크 조회';
}

function showMessage(text, type) {
  message.textContent = text;
  message.className = `message ${type}`;
}

function clearResult() {
  message.textContent = '';
  message.className = 'message';
  result.classList.remove('active');
  fields.folderLink.removeAttribute('href');
}
