const OPENROUTER_API_KEY = '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';

// === Защита от DevTools ===
(function() {
    // Блокировка правой кнопки мыши
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });

    // Блокировка горячих клавиш DevTools
    document.addEventListener('keydown', function(e) {
        // F12
        if (e.keyCode === 123) {
            e.preventDefault();
            return false;
        }
        // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
        if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
            e.preventDefault();
            return false;
        }
        // Ctrl+U (просмотр исходного кода)
        if (e.ctrlKey && e.keyCode === 85) {
            e.preventDefault();
            return false;
        }
    });

    // Обнаружение открытия DevTools через изменение размера окна
    let devtoolsOpen = false;
    const threshold = 160;

    const checkDevTools = function() {
        const widthThreshold = window.outerWidth - window.innerWidth > threshold;
        const heightThreshold = window.outerHeight - window.innerHeight > threshold;

        if (widthThreshold || heightThreshold) {
            if (!devtoolsOpen) {
                devtoolsOpen = true;
                document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#1a1a2e;color:#fff;font-family:sans-serif;text-align:center;"><h1>🛑 Закройте инструменты разработчика</h1></div>';
            }
        }
    };

    setInterval(checkDevTools, 1000);

    // Очистка консоли и предупреждение
    console.clear();
    console.log('%c⛔ СТОП!', 'color: red; font-size: 50px; font-weight: bold;');
    console.log('%cЭто функция браузера предназначена для разработчиков.', 'font-size: 16px;');
})();

const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const fileInput = document.getElementById('file-input');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const clearImageBtn = document.getElementById('clear-image');
const modal = document.getElementById('api-modal');
const closeBtn = document.getElementById('close-modal-btn');
const settingsBtn = document.getElementById('settings-btn');
const navItems = document.querySelectorAll('.nav-item');
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');

let currentMode = 'chat';
let currentImageBase64 = null;



function showModal() {
    modal.style.display = 'flex';
}

closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
});

settingsBtn.addEventListener('click', () => {
    showModal();
});


menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
     e.stopPropagation(); // предотвращаем срабатывание клика по документу
    sidebar.classList.toggle('open');
});


navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        currentMode = item.dataset.mode;
    });
});


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

clearImageBtn.addEventListener('click', clearImage);

function clearImage() {
    fileInput.value = '';
    currentImageBase64 = null;
    imagePreviewContainer.classList.add('hidden');
}


sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text && !currentImageBase64) return;

    if (currentImageBase64) {
        addMessage("[Изображение]", 'user', `data:image/jpeg;base64,${currentImageBase64}`);
    }
    if (text) {
        addMessage(text, 'user');
    }

    userInput.value = '';
    if (currentImageBase64) clearImage();

    const loadingId = addMessage('shaman думает...', 'ai', null, true);

    try {
        const response = await callQwen(text, currentImageBase64);
        updateMessage(loadingId, response);
    } catch (error) {
        updateMessage(loadingId, `Ошибка: ${error.message}`);
    }
}



function addMessage(text, sender, imgSrc = null, isLoading = false) {
    const div = document.createElement('div');
    div.classList.add('message', sender);
    if (isLoading) div.id = `loading-${Date.now()}`;

    if (imgSrc) {
        const img = document.createElement('img');
        img.src = imgSrc;
        img.classList.add('chat-img');
        div.appendChild(img);
    }

    if (text) {
        const p = document.createElement('div');
        p.textContent = text;
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

    let contentToShow = rawContent;
    const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/);
    const svgMatch = rawContent.match(/```svg\s*([\s\S]*?)\s*```/) || rawContent.match(/(<svg[\s\S]*?<\/svg>)/);

    if (currentMode === 'graph' && jsonMatch) {
        try {
            const graphData = JSON.parse(jsonMatch[1]);
            const plotDiv = document.createElement('div');
            plotDiv.className = 'plot-container';
            div.appendChild(plotDiv);

            const data = Array.isArray(graphData) ? graphData : (graphData.data || [graphData]);
            const layout = graphData.layout || {
                autosize: true,
                margin: { t: 30, r: 30, l: 40, b: 40 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)'
            };

            Plotly.newPlot(plotDiv, data, layout, { responsive: true });
            contentToShow = contentToShow.replace(jsonMatch[0], '');
        } catch (e) {
            console.error('Ошибка графика:', e);
        }
    }

    if ((currentMode === 'draw' || currentMode === 'chat') && svgMatch) {
        const svgCode = svgMatch[1] || svgMatch[0];
        const svgContainer = document.createElement('div');
        svgContainer.className = 'svg-container';
        svgContainer.innerHTML = svgCode;
        div.appendChild(svgContainer);
        contentToShow = contentToShow.replace(svgMatch[0], '');
    }

    if (contentToShow.trim()) {
        const textDiv = document.createElement('div');
        try {
            textDiv.innerHTML = marked.parse(contentToShow);
        } catch {
            textDiv.textContent = contentToShow;
        }
        div.appendChild(textDiv);
    }

    if (window.MathJax) {
        MathJax.typesetPromise([div]).catch(console.error);
    }

    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function callQwen(prompt, imageBase64 = null) {
    let systemPrompt = "Ты ShamanAi — умный помощник на базе шамана. Отвечай на русском. Используй LaTeX ($...$) для формул.";

    if (currentMode === 'graph') {
        systemPrompt += " Пользователь просит график. Верни ТОЛЬКО JSON для Plotly.js в ```json ... ```.";
    } else if (currentMode === 'draw') {
        systemPrompt += " Пользователь хочет рисунок. Верни ТОЛЬКО SVG в ```svg ... ``` с чёрными линиями.";
    }

    const messages = [{ role: "system", content: systemPrompt }];

    let userContent = "";
    if (imageBase64) {
        userContent += `![Изображение](data:image/jpeg;base64,${imageBase64})\n\n`;
    }
    if (prompt) {
        userContent += prompt;
    }
    messages.push({ role: "user", content: userContent });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'shamanAi'
        },
        body: JSON.stringify({
            model: "qwen/qwen-vl-plus",
            messages: messages,
            temperature: 0.7
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter: ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Нет ответа.";
}






