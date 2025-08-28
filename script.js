
document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements
    const inputText = document.getElementById('inputText');
    const toggleSpeakBtn = document.getElementById('toggleSpeakBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const speedInput = document.getElementById('speedInput');
    const speedUp = document.getElementById('speedUp');
    const speedDown = document.getElementById('speedDown');
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeValue = document.getElementById('volumeValue');
    const jumpButtons = document.querySelectorAll('.jump-btn');
    const wordInput = document.getElementById('wordInput');
    const wordUp = document.getElementById('wordUp');
    const wordDown = document.getElementById('wordDown');
    const wordSliderFull = document.getElementById('wordSliderFull');
    const wordPosition = document.getElementById('wordPosition');
    const totalWords = document.getElementById('totalWords');
    const wordCount = document.getElementById('wordCount');
    const phoneticsOutput = document.getElementById('phoneticsOutput');
    const ipaBtn = document.getElementById('ipaBtn');
    const englishBtn = document.getElementById('englishBtn');
    const clearBtn = document.getElementById('clearBtn');
    const pasteBtn = document.getElementById('pasteBtn');
    const androidWarning = document.getElementById('androidWarning');
    const voiceSelect = document.getElementById('voiceSelect');
    const loopSwitch = document.getElementById('loopSwitch');

    // Check if Android device
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
        androidWarning.style.display = 'block';
    }

    // Speech synthesis setup
    const synth = window.speechSynthesis;
    let utterance = null;
    let words = [];
    let currentWordIndex = -1;
    let isSpeaking = false;
    let isPaused = false;
    let showIPA = false; // English by default
    let wordTimingInterval = null;
    let voices = [];
    let loopEnabled = false;

    // Load available voices
    function loadVoices() {
        voices = synth.getVoices();
        voiceSelect.innerHTML = '<option value="">Default</option>';

        // Filter for English voices and categorize by gender
        const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));

        englishVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = voice.name;

            // Try to determine gender from voice name
            if (voice.name.includes('Female') || voice.name.includes('Woman') || voice.name.includes('Samantha')) {
                option.textContent += ' (Female)';
            } else if (voice.name.includes('Male') || voice.name.includes('Man') || voice.name.includes('Alex')) {
                option.textContent += ' (Male)';
            }

            voiceSelect.appendChild(option);
        });
    }

    // Load voices when they become available
    if (synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = loadVoices;
    }

    // Initial load
    setTimeout(loadVoices, 100);

    // Check for URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const textParam = urlParams.get('text');
    if (textParam) {
        inputText.value = decodeURIComponent(textParam);
    }

    // Loop switch handler
    loopSwitch.addEventListener('change', function () {
        loopEnabled = this.checked;
    });

    // Update input values
    speedInput.addEventListener('change', () => {
        let speedValue = parseFloat(speedInput.value);
        // Ensure value is within range
        speedValue = Math.min(2, Math.max(0.5, speedValue));
        speedInput.value = speedValue.toFixed(1);

        if (utterance) {
            utterance.rate = speedValue;
        }
    });

    // Speed increment/decrement
    speedUp.addEventListener('click', () => {
        let speedValue = parseFloat(speedInput.value) + 0.1;
        speedValue = Math.min(2, speedValue);
        speedInput.value = speedValue.toFixed(1);

        if (utterance) {
            utterance.rate = speedValue;
        }
    });

    speedDown.addEventListener('click', () => {
        let speedValue = parseFloat(speedInput.value) - 0.1;
        speedValue = Math.max(0.5, speedValue);
        speedInput.value = speedValue.toFixed(1);

        if (utterance) {
            utterance.rate = speedValue;
        }
    });

    volumeSlider.addEventListener('input', () => {
        volumeValue.textContent = volumeSlider.value;
        if (utterance) {
            utterance.volume = parseFloat(volumeSlider.value);
        }
    });

    // Word input handler
    wordInput.addEventListener('change', () => {
        let wordIndex = parseInt(wordInput.value);
        // Ensure value is within range
        wordIndex = Math.min(words.length - 1, Math.max(0, wordIndex));
        wordInput.value = wordIndex;

        jumpToWord(wordIndex);
    });

    // Word increment/decrement
    wordUp.addEventListener('click', () => {
        let wordIndex = parseInt(wordInput.value) + 1;
        wordIndex = Math.min(words.length - 1, wordIndex);
        wordInput.value = wordIndex;

        jumpToWord(wordIndex);
    });

    wordDown.addEventListener('click', () => {
        let wordIndex = parseInt(wordInput.value) - 1;
        wordIndex = Math.max(0, wordIndex);
        wordInput.value = wordIndex;

        jumpToWord(wordIndex);
    });

    // Toggle between IPA and English
    ipaBtn.addEventListener('click', () => {
        showIPA = true;
        ipaBtn.classList.add('active');
        englishBtn.classList.remove('active');
        updatePhoneticsDisplay();
    });

    englishBtn.addEventListener('click', () => {
        showIPA = false;
        englishBtn.classList.add('active');
        ipaBtn.classList.remove('active');
        updatePhoneticsDisplay();
    });

    // Clear text button
    clearBtn.addEventListener('click', () => {
        inputText.value = '';
        inputText.focus();
    });

    // Paste from clipboard button
    pasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            inputText.value = text;
            updatePhoneticsDisplay();
        } catch (err) {
            alert('Failed to read from clipboard. Please paste manually.');
            console.error('Failed to read from clipboard:', err);
        }
    });

    // Toggle speak/stop
    toggleSpeakBtn.addEventListener('click', () => {
        if (isSpeaking) {
            stopSpeaking();
        } else {
            speakText();
        }
    });

    // Pause/resume functionality
    pauseBtn.addEventListener('click', () => {
        if (isSpeaking) {
            if (isPaused) {
                // Resume speaking
                if (isAndroid) {
                    // For Android, we need to restart the word-by-word process
                    speakWordByWord();
                } else {
                    synth.resume();
                }
                isPaused = false;
                pauseBtn.textContent = 'Pause';
                pauseBtn.classList.remove('paused');
            } else {
                // Pause speaking
                if (isAndroid) {
                    clearTimeout(wordTimingInterval);
                } else {
                    synth.pause();
                }
                isPaused = true;
                pauseBtn.textContent = 'Resume';
                pauseBtn.classList.add('paused');
            }
        }
    });

    // Update button appearances
    function updateButtonStates() {
        if (isSpeaking) {
            toggleSpeakBtn.textContent = 'Stop';
            toggleSpeakBtn.classList.add('speaking');
            pauseBtn.style.display = 'inline-block';
        } else {
            toggleSpeakBtn.textContent = 'Speak';
            toggleSpeakBtn.classList.remove('speaking');
            pauseBtn.style.display = 'inline-block';
            pauseBtn.textContent = 'Pause';
            pauseBtn.classList.remove('paused');
            isPaused = false;
        }

        // Disable pause button if not speaking
        pauseBtn.disabled = !isSpeaking;
    }

    // Generate simple phonetics (for demonstration)
    function generatePhonetics(text, useIPA) {
        // This is a simplified demonstration - real phonetics would require a library
        const words = text.split(' ');

        if (useIPA) {
            // Mock IPA representation
            return words.map(word => {
                if (word.toLowerCase() === "the") return "ðə";
                if (word.toLowerCase() === "quick") return "kwɪk";
                if (word.toLowerCase() === "brown") return "braʊn";
                if (word.toLowerCase() === "fox") return "fɒks";
                if (word.toLowerCase() === "jumps") return "dʒʌmps";
                if (word.toLowerCase() === "over") return "ˈəʊvə";
                if (word.toLowerCase() === "lazy") return "ˈleɪzi";
                if (word.toLowerCase() === "dog") return "dɒɡ";
                if (word.toLowerCase() === "this") return "ðɪs";
                if (word.toLowerCase() === "sentence") return "ˈsɛntəns";
                if (word.toLowerCase() === "contains") return "kənˈteɪnz";
                if (word.toLowerCase() === "all") return "ɔːl";
                if (word.toLowerCase() === "letters") return "ˈlɛtəz";
                if (word.toLowerCase() === "of") return "ɒv";
                if (word.toLowerCase() === "english") return "ˈɪŋɡlɪʃ";
                if (word.toLowerCase() === "alphabet") return "ˈælfəbɛt";

                // Default transformation for unknown words
                if (word.length <= 2) return word;
                if (word.endsWith('.')) {
                    return word.substring(0, 2) + '-' + word.substring(2, word.length - 1);
                }
                return word.substring(0, 2) + '-' + word.substring(2);
            }).join(' ');
        } else {
            // Simple English phonetics
            return words.map(word => {
                if (word.length <= 3) return word;

                if (word.endsWith('.')) {
                    return word.substring(0, 2) + '-' + word.substring(2, word.length - 1) + '(.)';
                }
                return word.substring(0, 2) + '-' + word.substring(2);
            }).join(' ');
        }
    }

    // Update phonetics display based on current mode
    function updatePhoneticsDisplay() {
        const text = inputText.value.trim();
        if (text === '') {
            phoneticsOutput.innerHTML = '';
            wordCount.textContent = 'Total words: 0';
            totalWords.textContent = '0';
            return;
        }

        const phonetics = generatePhonetics(text, showIPA);
        words = text.split(' ');

        phoneticsOutput.innerHTML = words.map((word, index) => {
            const phoneticWord = generatePhonetics(word, showIPA);
            return `<span id="word-${index}" class="${showIPA ? 'ipa' : ''}">${phoneticWord}</span>`;
        }).join(' ');

        wordCount.textContent = `Total words: ${words.length}`;
        totalWords.textContent = words.length;

        // Set up word slider
        wordSliderFull.max = words.length - 1;
        wordInput.max = words.length - 1;
        wordInput.value = currentWordIndex >= 0 ? currentWordIndex : 0;
        wordSliderFull.value = currentWordIndex >= 0 ? currentWordIndex : 0;

        // Update position display
        wordPosition.textContent = `${currentWordIndex >= 0 ? currentWordIndex + 1 : 0}/${words.length}`;

        // Re-highlight current word if needed
        if (currentWordIndex >= 0) {
            highlightWord(currentWordIndex);
        }
    }

    // Highlight the current word being spoken
    function highlightWord(index) {
        // Remove previous highlights
        const highlighted = document.querySelectorAll('.highlight');
        highlighted.forEach(el => {
            el.classList.remove('highlight');
            el.classList.remove('current');
        });

        // Highlight current word
        if (index >= 0 && index < words.length) {
            const wordElement = document.getElementById(`word-${index}`);
            if (wordElement) {
                wordElement.classList.add('highlight');
                wordElement.classList.add('current');
                wordElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Update word input position
                wordInput.value = index;
                wordSliderFull.value = index;
                wordPosition.textContent = `${index + 1}/${words.length}`;
            }
        }
    }

    // Speak text word by word (for Android Chrome)
    function speakWordByWord() {
        if (currentWordIndex >= words.length - 1 || isPaused) {
            // Reached the end or paused
            if (currentWordIndex >= words.length - 1) {
                if (loopEnabled) {
                    // If loop is enabled, start from the beginning
                    currentWordIndex = -1;
                    setTimeout(speakWordByWord, 500);
                } else {
                    stopSpeaking();
                }
            }
            return;
        }

        currentWordIndex++;
        highlightWord(currentWordIndex);

        // Create utterance for just this word
        const wordToSpeak = words[currentWordIndex].replace(/[.,?!]/g, '');
        utterance = new SpeechSynthesisUtterance(wordToSpeak);
        utterance.rate = parseFloat(speedInput.value);
        utterance.volume = parseFloat(volumeSlider.value);

        // Set selected voice if available
        if (voiceSelect.value) {
            const selectedVoice = voices.find(voice => voice.name === voiceSelect.value);
            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }
        }

        utterance.onend = function () {
            // Speak next word after a short delay
            if (!isPaused) {
                wordTimingInterval = setTimeout(speakWordByWord, 200);
            }
        };

        utterance.onerror = function () {
            // Continue with next word even if there's an error
            if (!isPaused) {
                wordTimingInterval = setTimeout(speakWordByWord, 200);
            }
        };

        synth.speak(utterance);
    }

    // Speak the text
    function speakText() {
        if (synth.speaking) {
            synth.cancel();
        }

        const text = inputText.value.trim();
        if (text === '') return;

        // Update phonetics display
        updatePhoneticsDisplay();

        // Start from the beginning or current position
        if (currentWordIndex < 0 || currentWordIndex >= words.length) {
            currentWordIndex = -1;
        }

        // For Android Chrome, speak word by word
        if (isAndroid) {
            isSpeaking = true;
            isPaused = false;
            updateButtonStates();
            speakWordByWord();
        } else {
            // For other browsers, use the standard approach
            utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = parseFloat(speedInput.value);
            utterance.volume = parseFloat(volumeSlider.value);

            // Set selected voice if available
            if (voiceSelect.value) {
                const selectedVoice = voices.find(voice => voice.name === voiceSelect.value);
                if (selectedVoice) {
                    utterance.voice = selectedVoice;
                }
            }

            // Track words as they're spoken (if supported)
            utterance.onboundary = function (event) {
                if (event.name === 'word' && !isPaused) {
                    const charIndex = event.charIndex;
                    let currentIndex = 0;

                    for (let i = 0; i < words.length; i++) {
                        currentIndex += words[i].length + 1; // +1 for space
                        if (charIndex < currentIndex) {
                            currentWordIndex = i;
                            highlightWord(i);
                            break;
                        }
                    }
                }
            };

            utterance.onend = function () {
                if (loopEnabled && !isPaused) {
                    // If loop is enabled, start from the beginning
                    currentWordIndex = -1;
                    setTimeout(speakText, 500);
                } else {
                    currentWordIndex = -1;
                    isSpeaking = false;
                    isPaused = false;
                    updateButtonStates();
                    wordPosition.textContent = `0/${words.length}`;
                }
            };

            utterance.onerror = function () {
                isSpeaking = false;
                isPaused = false;
                updateButtonStates();
            };

            synth.speak(utterance);
            isSpeaking = true;
            isPaused = false;
            updateButtonStates();
        }
    }

    // Stop speaking
    function stopSpeaking() {
        if (synth.speaking) {
            synth.cancel();
        }
        clearTimeout(wordTimingInterval);
        isSpeaking = false;
        isPaused = false;
        updateButtonStates();

        // Reset to beginning if we were at the end
        if (currentWordIndex >= words.length - 1) {
            currentWordIndex = -1;
            wordPosition.textContent = `0/${words.length}`;
        }
    }

    // Jump to specific word
    function jumpToWord(wordIndex) {
        if (words.length === 0) return;

        // Ensure wordIndex is within bounds
        wordIndex = Math.max(0, Math.min(wordIndex, words.length - 1));

        // Stop current speech
        stopSpeaking();

        // Update current position
        currentWordIndex = wordIndex;
        highlightWord(wordIndex);
    }

    // Jump by number of words
    function jumpByWords(wordCount) {
        if (words.length === 0) return;

        let newIndex = currentWordIndex + wordCount;

        // If we haven't started speaking yet, adjust accordingly
        if (currentWordIndex === -1 && wordCount > 0) {
            newIndex = wordCount - 1;
        }

        // Ensure the new index is within bounds
        newIndex = Math.max(0, Math.min(newIndex, words.length - 1));

        jumpToWord(newIndex);
    }

    // Event listeners
    jumpButtons.forEach(button => {
        button.addEventListener('click', () => {
            const words = parseInt(button.getAttribute('data-words'));
            jumpByWords(words);
        });
    });

    wordSliderFull.addEventListener('input', () => {
        const wordIndex = parseInt(wordSliderFull.value);
        wordInput.value = wordIndex;
        wordPosition.textContent = `${wordIndex + 1}/${words.length}`;
    });

    wordSliderFull.addEventListener('change', () => {
        const wordIndex = parseInt(wordSliderFull.value);
        jumpToWord(wordIndex);
    });

    // Update phonetics when text changes
    inputText.addEventListener('input', updatePhoneticsDisplay);

    // Initialize with example text
    const sampleText = inputText.value;
    words = sampleText.split(' ');
    updatePhoneticsDisplay();

    // Initialize button states
    updateButtonStates();
});
