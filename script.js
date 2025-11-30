// Константы и переменные
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const fileInput = document.getElementById('file-input');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const clearImageBtn = document.getElementById('clear-image');
const modal = document.getElementById('api-modal');
const saveKeyBtn = document.getElementById('save-key-btn');
const apiKeyInput = document.getElementById('api-key-input');
const settingsBtn = document.getElementById('settings-btn');
const navItems = document.querySelectorAll('.nav-item');

let currentMode = 'chat'; // chat, draw, graph
let currentImageBase64 = null;

// --- Управление API ключом ---
let apiKey = localStorage.getItem('shamanAi_qween_key'); // Изменено хранилище для Qween API

// Проверяем ключ при запуске
if (!apiKey) {
    showModal();
}

function showModal() {
    modal.style.display = 'flex';
    // Обновляем текст модального окна для Qween
    document.querySelector('.modal-content h3').innerText = 'Qween API Key';
    document.querySelector('.modal-content p').innerText = 'Вставь ключ от Qween AI Platform.';
    document.querySelector('.small-text a').href = '#'; // Нет ссылки, так как API гипотетический
}

saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        apiKey = key;
        localStorage.setItem('shamanAi_qween_key', key);
        modal.style.display = 'none';
    } else {
        alert('Пожалуйста, введите ключ');
    }
});

settingsBtn.addEventListener('click', () => {
    showModal();
    apiKeyInput.value = apiKey || '';
});

// --- Навигация (Табы) ---
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        currentMode = item.getAttribute('data-mode');
    });
});

// --- Обработка изображений ---
fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            currentImageBase64 = e.target.result.split(',')[1]; 
            imagePreview.src = e.target.result;
            imagePreviewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});

clearImageBtn.addEventListener('click', () => {
    clearImage();
});

function clearImage() {
    fileInput.value = '';
    currentImageBase64 = null;
    imagePreviewContainer.classList.add('hidden');
}

// --- Чат логика ---
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

async function sendMessage() {
    const text = userInput.value.trim();
    
    // Предупреждение о работе с изображениями (предполагаем, что Qween API - только текст)
    if (currentImageBase64) {
        addMessage("⚠️ Qween API (эта версия) работает только с текстом. Я не смогу проанализировать отправленное фото. Пожалуйста, опишите задачу словами.", "ai");
        clearImage();
        if (!text) return; 
    }

    if (!text) return;

    // Отображаем сообщение пользователя
    addMessage(text, 'user');

    // Очистка ввода
    userInput.value = '';

    // Показываем индикатор загрузки
    const loadingId = addMessage('Qween думает...', 'ai', null, true);

    try {
        const response = await callQween(text);
        updateMessage(loadingId, response);
    } catch (error) {
        updateMessage(loadingId, 'Ошибка связи Qween: ' + error.message);
        console.error(error);
    }
}

function addMessage(text, sender, imgSrc = null, isLoading = false) {
    const div = document.createElement('div');
    div.classList.add('message', sender);
    if (isLoading) div.id = 'loading-' + Date.now();

    if (imgSrc) {
        const img = document.createElement('img');
        img.src = imgSrc;
        img.classList.add('chat-img');
        div.appendChild(img);
    }

    if (text) {
        const p = document.createElement('div');
        p.innerHTML = text; 
        div.appendChild(p);
    }

    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return div.id;
}

function updateMessage(id, rawContent) {
    const div = document.getElementById(id);
    if (!div) return;
    div.innerHTML = ''; 

    // Регулярки для поиска JSON (графики) и SVG (рисунки)
    const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/);
    const svgMatch = rawContent.match(/```svg\s*([\s\S]*?)\s*```/) || rawContent.match(/<svg[\s\S]*?<\/svg>/);

    let contentToShow = rawContent;

    // 1. Графики (Plotly)
    if (currentMode === 'graph' && jsonMatch) {
        try {
            const graphData = JSON.parse(jsonMatch[1]);
            const plotDiv = document.createElement('div');
            plotDiv.classList.add('plot-container');
            div.appendChild(plotDiv);
            
            // Обработка данных для Plotly
            const data = graphData.data || graphData; 
            const layout = graphData.layout || { 
                autosize: true, 
                margin: { t: 30, r: 30, l: 40, b: 40 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)'
            };
            
            Plotly.newPlot(plotDiv, data, layout, {responsive: true});
            
            // Убираем JSON из видимого текста
            contentToShow = contentToShow.replace(jsonMatch[0], '');
        } catch (e) {
            console.error('Ошибка парсинга графика', e);
        }
    }

    // 2. Векторные рисунки (SVG)
    if ((currentMode === 'draw' || currentMode === 'chat') && svgMatch) {
        const svgContent = svgMatch[1] || svgMatch[0];
        const svgContainer = document.createElement('div');
        svgContainer.classList.add('svg-container');
        svgContainer.innerHTML = svgContent;
        div.appendChild(svgContainer);
        
        // Убираем SVG код из текста
        contentToShow = contentToShow.replace(svgMatch[0], '');
    }

    // Рендеринг Markdown и формул
    const textDiv = document.createElement('div');
    textDiv.innerHTML = marked.parse(contentToShow);
    div.appendChild(textDiv);

    // MathJax (Формулы)
    if (window.MathJax) {
        MathJax.typesetPromise([div]);
    }

    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function callQween(prompt) { // <-- Имя функции изменено на callQween и добавлен аргумент prompt
    if (!apiKey) throw new Error('API ключ не установлен');

    // Предполагаемый URL для Qween API
    const url = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions'; // Убедитесь, что конечная точка указана правильно

    // Формируем системный промпт в зависимости от режима
    let systemPrompt = "Ты ShamanAi, умный помощник, работающий на Qween AI. Используй LaTeX для формул (формат $$formula$$ или $formula$). Отвечай на русском языке.";

    if (currentMode === 'graph') {
        systemPrompt += " Пользователь хочет построить график. Твоя задача — сгенерировать JSON для библиотеки Plotly.js. Верни ТОЛЬКО JSON внутри блока ```json ... ```";
    } else if (currentMode === 'draw') {
        systemPrompt += " Пользователь просит нарисовать геометрическую фигуру или схему. Сгенерируй валидный SVG код внутри блока ```svg ... ```. Используй stroke='black' и fill='none' или прозрачные цвета, чтобы было видно на белом фоне. Добавляй подписи (text) внутри SVG.";
    }

    const requestBody = {
        model: "qwen-plus", // Гипотетическая модель Qween
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt } // <-- Используем аргумент prompt
        ],
        temperature: 0.7,
        stream: false 
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}` 
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || `Ошибка сервера Qween (HTTP ${response.status})`);
    }

    const data = await response.json();
    
    // Проверка структуры ответа. Предполагаем стандартный формат.
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        return data.choices[0].message.content;
    }

    throw new Error("Qween вернул некорректный ответ.");
}
