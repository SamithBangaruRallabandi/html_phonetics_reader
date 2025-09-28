
// ===== FIREBASE INITIALIZATION =====
// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAShFX424tWfaN3OEyu7fqT3IOOHPhGDJc",
  authDomain: "phonetics-reader-int.firebaseapp.com",
  projectId: "phonetics-reader-int",
  storageBucket: "phonetics-reader-int.firebasestorage.app",
  messagingSenderId: "588767398776",
  appId: "1:588767398776:web:7d30c49ca375f2a314568d",
  measurementId: "G-5F07315XRQ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const analytics = firebase.analytics();

const usersRef = (uid) => db.collection("users").doc(uid);
const communityRef = db.collection("community");

// Enable persistence for offline capability
db.enablePersistence()
  .catch((err) => {
    console.log("Firebase persistence error: ", err);
  });

// Auth state variable
let currentUser = null;

// Auth functions
function initAuth() {
    document.getElementById('signInButton').style.display = 'block';
    document.getElementById('userInfo').style.display = 'none';
    
    // Listen for auth state changes
    auth.onAuthStateChanged((user) => {
        if (user) {
            // User is signed in
            currentUser = user;
            document.getElementById('signInButton').style.display = 'none';
            document.getElementById('userInfo').style.display = 'flex';
            document.getElementById('userPhoto').src = user.photoURL;
            document.getElementById('userName').textContent = user.displayName;
            
            // Log login event to analytics
            analytics.logEvent('login', {
                method: 'Google'
            });
            
            // DEBUG: Log that we're loading user data
            console.log("User signed in, loading user data...");
            
            // Load user data
            loadUserData();
        } else {
            // User is signed out
            currentUser = null;
            document.getElementById('signInButton').style.display = 'block';
            document.getElementById('userInfo').style.display = 'none';
            
            // DEBUG: Clear history when signed out
            document.getElementById("historyList").innerHTML = "<li>Please sign in to view your history</li>";
        }
    });
    
    // Add event listeners
    document.getElementById('signInButton').addEventListener('click', signInWithGoogle);
    document.getElementById('signOutButton').addEventListener('click', signOut);
}

function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then((result) => {
            // Success - handled by auth state listener
        })
        .catch((error) => {
            console.error("Sign in error: ", error);
            alert("Sign in failed: " + error.message);
        });
}

function signOut() {
    auth.signOut()
        .then(() => {
            // Success - handled by auth state listener
        })
        .catch((error) => {
            console.error("Sign out error: ", error);
        });
}

// deleteHistoryItem 
function deleteHistoryItem(id) {
    if (!currentUser) {
        alert("You must be logged in to delete history");
        return;
    }
    
    if (confirm("Are you sure you want to delete this history item?")) {
        usersRef(currentUser.uid).collection("history").doc(id).delete()
        .then(() => {
            console.log("History item deleted");
            // Refresh the history list after deletion
            loadUserData();
        })
        .catch((error) => {
            console.error("Error deleting history item: ", error);
            alert("Error deleting history item: " + error.message);
        });
    }
}

// loadUserData function to display history items
function loadUserData() {
    if (!currentUser) {
        console.log("No user logged in, cannot load history");
        document.getElementById("historyList").innerHTML = "<li>Please sign in to view your history</li>";
        return;
    }

    console.log("Loading history for user:", currentUser.uid);
    
    usersRef(currentUser.uid).collection("history")
    .orderBy("createdAt", "desc")
    .limit(20)
    .get()
    .then(snapshot => {
        const list = document.getElementById("historyList");
        console.log("Found", snapshot.size, "history items");
        
        list.innerHTML = "";
        
        if (snapshot.empty) {
            list.innerHTML = "<li>No history yet. Process some text to see it here.</li>";
            return;
        }
        
        snapshot.forEach(doc => {
            const item = doc.data();
            console.log("History item:", item);
            
            const li = document.createElement("li");
            
            // Text content
            const textContent = document.createElement("div");
            textContent.textContent = item.text;
            textContent.className = "history-text";
            
            // Button container
            const buttonContainer = document.createElement("div");
            buttonContainer.className = "history-buttons";
            
            // Delete button
            const delBtn = document.createElement("button");
            delBtn.textContent = "Delete";
            delBtn.className = "text-btn delete-btn";
            delBtn.addEventListener('click', function() {
                deleteHistoryItem(doc.id);
            });

            // Publish button - FIXED
            const pubBtn = document.createElement("button");
            pubBtn.textContent = "Publish";
            pubBtn.className = "text-btn publish-btn";
            pubBtn.addEventListener('click', function() {
                openPublishModal(doc.id, item.text);
            });

            buttonContainer.appendChild(pubBtn);
            buttonContainer.appendChild(delBtn);
            
            li.appendChild(textContent);
            li.appendChild(buttonContainer);
            list.appendChild(li);
        });
    })
    .catch(error => {
        console.error("Error loading history: ", error);
        document.getElementById("historyList").innerHTML = `<li>Error loading history: ${error.message}</li>`;
    });
}

function openPublishModal(id, text) {
    console.log("Opening publish modal for:", {id, text});
    document.getElementById("publishModal").style.display = "block";
    document.getElementById("publishTextPreview").textContent = text;
    
    // Store the text in a data attribute for later use
    document.getElementById("publishModal").dataset.publishText = text;
}

// Add this separate function for the confirm button
function setupPublishHandler() {
    document.getElementById("confirmPublishBtn").onclick = function() {
        const text = document.getElementById("publishModal").dataset.publishText;
        const publishClass = document.getElementById("publishClass").value;
        const tags = document.getElementById("publishTags").value.split(",").map(t => t.trim());
        
        console.log("Publishing:", {text, publishClass, tags});
        
        if (!text) {
            alert("No text to publish!");
            return;
        }
        
        communityRef.add({
            uid: currentUser.uid,
            text: text,
            class: publishClass,
            tags: tags,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then((docRef) => {
            console.log("Published successfully with ID:", docRef.id);
            document.getElementById("publishModal").style.display = "none";
            alert("Published successfully to community!");
            loadCommunityReads();
        })
        .catch((error) => {
            console.error("Error publishing:", error);
            alert("Error publishing: " + error.message);
        });
    };
}

function loadCommunityReads() {
    communityRef.orderBy("createdAt", "desc").onSnapshot(snapshot => {
        const list = document.getElementById("communityList");
        list.innerHTML = "";
        
        if (snapshot.empty) {
            list.innerHTML = "<li>No community reads yet. Be the first to publish!</li>";
            return;
        }
        
        snapshot.forEach(doc => {
            const item = doc.data();
            const li = document.createElement("li");
            li.textContent = `${item.text} [${item.class}] (${item.tags.join(", ")})`;
            list.appendChild(li);
        });
    }, error => {
        console.error("Error loading community reads: ", error);
        document.getElementById("communityList").innerHTML = "<li>Error loading community reads</li>";
    });
}

// ===== END FIREBASE INITIALIZATION =====

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
    const arpabetBtn = document.getElementById('arpabetBtn');
    const clearBtn = document.getElementById('clearBtn');
    const pasteBtn = document.getElementById('pasteBtn');
    const androidWarning = document.getElementById('androidWarning');
    const voiceSelect = document.getElementById('voiceSelect');
    const loopSwitch = document.getElementById('loopSwitch');
    const autoCorrectBtn = document.getElementById('autoCorrectBtn');
    const promptSelect = document.getElementById('promptSelect');
    const managePromptsBtn = document.getElementById('managePromptsBtn');
    const promptsModal = document.getElementById('promptsModal');
    const closeModal = document.querySelector('.close');
    const newPromptName = document.getElementById('newPromptName');
    const newPromptText = document.getElementById('newPromptText');
    const addPromptBtn = document.getElementById('addPromptBtn');
    const customPromptsList = document.getElementById('customPromptsList');
    const microphoneBtn = document.getElementById('microphoneBtn');

=======
    const signInButton = document.getElementById('signInButton');
    const signOutButton = document.getElementById('signOutButton');


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

    // Speech recognition variables
    let recognition = null;
    let isListening = false;
    let recognizedWords = [];

    let showARPAbet = false;
    let currentTranscriptionMode = 'english';

    let transcriptionCache = {
        ipa: {},
        arpabet: {}
    };

    // Clear cache when text changes significantly
    inputText.addEventListener('input', () => {
        // Clear cache when user modifies text
        transcriptionCache.ipa = {};
        transcriptionCache.arpabet = {};
    });

    // Create recognition status element
    const recognitionStatus = document.createElement('div');
    recognitionStatus.className = 'recognition-status';
    document.body.appendChild(recognitionStatus);

    // Prompt system variables
    let customPrompts = {};
    const defaultPrompts = {
        'autocorrect': 'Autocorrect this: {text}',
        'dictionary': 'Define this word: {text}',
        'translate': 'Translate to English: {text}'
    };

    // Initialize prompts from localStorage
    function initPrompts() {
        const savedPrompts = localStorage.getItem('customPrompts');
        if (savedPrompts) {
            customPrompts = JSON.parse(savedPrompts);
            updatePromptSelect();
            renderCustomPromptsList();
        }
    }
    
    // Check for speech recognition support
    function checkSpeechRecognitionSupport() {
        if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
            // Show a message to the user
            const warning = document.createElement('div');
            warning.className = 'android-warning';
            warning.textContent = 'Speech recognition is not supported in your browser. Try using Chrome or Edge.';
            warning.style.display = 'block';
            warning.style.marginTop = '10px';
            
            // Insert after the microphone button
            microphoneBtn.parentNode.insertBefore(warning, microphoneBtn.nextSibling);
            
            // Disable the microphone button
            microphoneBtn.disabled = true;
            return false;
        }
        return true;
    }

    // Save prompts to localStorage
    function savePrompts() {
        localStorage.setItem('customPrompts', JSON.stringify(customPrompts));
    }

    // Update prompt select dropdown
    function updatePromptSelect() {
        // Clear existing custom options (if any)
        const customOptions = promptSelect.querySelectorAll('[data-custom]');
        customOptions.forEach(option => option.remove());
        
        // Add custom prompts to dropdown
        Object.keys(customPrompts).forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = key;
            option.setAttribute('data-custom', 'true');
            promptSelect.appendChild(option);
        });
    }

    // Render custom prompts list in modal
    function renderCustomPromptsList() {
        customPromptsList.innerHTML = '';
        
        Object.keys(customPrompts).forEach(key => {
            const li = document.createElement('li');
            
            const promptItem = document.createElement('div');
            promptItem.className = 'prompt-item';
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'prompt-name';
            nameSpan.textContent = key;
            
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'prompt-actions';
            
            const useButton = document.createElement('button');
            useButton.className = 'use-prompt';
            useButton.textContent = 'Use';
            useButton.addEventListener('click', () => {
                promptSelect.value = key;
                promptsModal.style.display = 'none';
            });
            
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-prompt';
            deleteButton.textContent = 'Delete';
            deleteButton.addEventListener('click', () => {
                delete customPrompts[key];
                savePrompts();
                updatePromptSelect();
                renderCustomPromptsList();
            });
            
            actionsDiv.appendChild(useButton);
            actionsDiv.appendChild(deleteButton);
            
            promptItem.appendChild(nameSpan);
            promptItem.appendChild(actionsDiv);
            
            li.appendChild(promptItem);
            customPromptsList.appendChild(li);
        });
    }

    // Get the current prompt template
    function getCurrentPrompt() {
        const selectedValue = promptSelect.value;
        let promptText = '';
        
        if (defaultPrompts[selectedValue]) {
            promptText = defaultPrompts[selectedValue];
        } else if (customPrompts[selectedValue]) {
            promptText = customPrompts[selectedValue];
        } else {
            promptText = defaultPrompts['autocorrect']; // Fallback
        }
        
        // Ensure the prompt contains {text} placeholder
        if (!promptText.includes('{text}')) {
            promptText += ' {text}';
        }
        
        return promptText;
    }

    // Initialize speech recognition
    function initSpeechRecognition() {
        if (!checkSpeechRecognitionSupport()) {
            return;
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        // Recognition event handlers
        recognition.onstart = function() {
            isListening = true;
            microphoneBtn.textContent = '🔴 Stop';
            microphoneBtn.classList.add('listening');
            recognitionStatus.textContent = 'Listening...';
            recognitionStatus.classList.add('active');
            recognizedWords = [];
        };

        recognition.onresult = function(event) {
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    // Store current text and selection
                    const currentText = inputText.value;
                    const startPos = inputText.selectionStart;
                    const endPos = inputText.selectionEnd;
                    
                    // Add the recognized text
                    const newText = currentText.substring(0, startPos) + 
                                transcript + 
                                currentText.substring(endPos, currentText.length);
                    
                    inputText.value = newText;
                    
                    // Highlight the newly added words in the input field
                    highlightInputText(startPos, startPos + transcript.length);
                    
                    // Update phonetics display
                    updatePhoneticsDisplay();
                } else {
                    interimTranscript += transcript;
                }
            }
            
            // Show interim results in status
            if (interimTranscript) {
                recognitionStatus.textContent = 'Listening: ' + interimTranscript;
            }
        };


                recognition.onerror = function(event) {
                    console.error('Speech recognition error', event.error);
                    recognitionStatus.textContent = 'Error: ' + event.error;
                    stopRecognition();
                    
                    // Reset after a delay
                    setTimeout(() => {
                        recognitionStatus.classList.remove('active');
                    }, 2000);
                };

                recognition.onend = function() {
                    stopRecognition();
                    recognitionStatus.textContent = 'Speech recognition ended';
                    
                    // Hide status after a delay
                    setTimeout(() => {
                        recognitionStatus.classList.remove('active');
                    }, 2000);
                };
            }
=======
        recognition.onerror = function(event) {
            console.error('Speech recognition error', event.error);
            recognitionStatus.textContent = 'Error: ' + event.error;
            stopRecognition();
            
            // Reset after a delay
            setTimeout(() => {
                recognitionStatus.classList.remove('active');
            }, 2000);
        };

        recognition.onend = function() {
            stopRecognition();
            recognitionStatus.textContent = 'Speech recognition ended';
            
            // Hide status after a delay
            setTimeout(() => {
                recognitionStatus.classList.remove('active');
            }, 2000);
        };
    }


    // Start speech recognition
    function startRecognition() {
        if (recognition) {
            try {
                recognition.start();
            } catch (error) {
                console.error('Recognition start error:', error);
                // Try again after a short delay if already started
                setTimeout(() => {
                    if (!isListening) {
                        recognition.start();
                    }
                }, 100);
            }
        }
    }

    // Stop speech recognition
    function stopRecognition() {
        if (recognition && isListening) {
            recognition.stop();
            isListening = false;
            microphoneBtn.textContent = '🎤 Speech Input';
            microphoneBtn.classList.remove('listening');
        }
    }

    // Toggle recognition
    function toggleRecognition() {
        if (isListening) {
            stopRecognition();
        } else {
            startRecognition();
        }
    }

    function highlightInputText(start, end) {
        inputText.focus();
        inputText.setSelectionRange(start, end);
        
        // Use a temporary marker to create a highlight effect
        setTimeout(() => {
            // Scroll to the highlighted area
            inputText.scrollLeft = inputText.scrollWidth;
            
            // Remove selection after a delay to create highlight effect
            setTimeout(() => {
                inputText.setSelectionRange(end, end);
            }, 500);
        }, 10);
    }

    // Function to highlight a recognized word temporarily
    function highlightRecognizedWord(wordIndex) {
        // Wait a bit to ensure DOM is updated
        setTimeout(() => {
            const wordElement = document.getElementById(`word-${wordIndex}`);
            if (wordElement) {
                // Add recognition highlight class
                wordElement.classList.add('recognized');
                
                // Remove highlight after a short delay
                setTimeout(() => {
                    if (wordElement) {
                        wordElement.classList.remove('recognized');
                    }
                }, 1000);
            }
        }, 50);
    }

    // Modal functionality
    managePromptsBtn.addEventListener('click', () => {
        promptsModal.style.display = 'block';
    });

    closeModal.addEventListener('click', () => {
        promptsModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === promptsModal) {
            promptsModal.style.display = 'none';
        }
    });

    addPromptBtn.addEventListener('click', () => {
        const name = newPromptName.value.trim();
        let text = newPromptText.value.trim();
        
        if (!name || !text) {
            alert('Please enter both a name and prompt text.');
            return;
        }
        
        // Automatically add {text} placeholder if not included
        if (!text.includes('{text}')) {
            text += ' {text}';
        }
        
        // Add or update custom prompt
        customPrompts[name] = text;
        savePrompts();
        updatePromptSelect();
        renderCustomPromptsList();
        
        // Clear form
        newPromptName.value = '';
        newPromptText.value = '';
        
        // Select the new prompt
        promptSelect.value = name;
        
        // Show confirmation message
        alert(`Prompt "${name}" added successfully!`);
    });

    // Initialize prompts system
    initPrompts();

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

    // Toggle between IPA, English and ARPAbet
    ipaBtn.addEventListener('click', () => {
        showIPA = true;
        showARPAbet = false;
        currentTranscriptionMode = 'ipa';
        ipaBtn.classList.add('active');
        arpabetBtn.classList.remove('active');
        englishBtn.classList.remove('active');
        updatePhoneticsDisplay();
    });

    arpabetBtn.addEventListener('click', () => {
        showIPA = false;
        showARPAbet = true;
        currentTranscriptionMode = 'arpabet';
        arpabetBtn.classList.add('active');
        ipaBtn.classList.remove('active');
        englishBtn.classList.remove('active');
        updatePhoneticsDisplay();
    });

    englishBtn.addEventListener('click', () => {
        showIPA = false;
        showARPAbet = false;
        currentTranscriptionMode = 'english';
        englishBtn.classList.add('active');
        ipaBtn.classList.remove('active');
        arpabetBtn.classList.remove('active');
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
                if (word.toLowerCase() === "english") return "ˈɪŋɡlīʃ";
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
    async function updatePhoneticsDisplay() {
        const text = inputText.value.trim();
        if (text === '') {
            phoneticsOutput.innerHTML = '';
            wordCount.textContent = 'Total words: 0';
            totalWords.textContent = '0';
            return;
        }

        // Always use the original text for word splitting and navigation
        words = text.split(' ');

        // Show loading state only for API calls
        if (currentTranscriptionMode !== 'english') {
            phoneticsOutput.innerHTML = '<div class="loading">Loading transcription...</div>';
        }

        try {
            let phonetics;
            
            if (currentTranscriptionMode === 'english') {
                // Use the simple English phonetics (existing functionality)
                phonetics = generatePhonetics(text, false);
                displayPhonetics(phonetics);
            } else {
                // Call pollinations.ai for IPA or ARPAbet
                phonetics = await getTranscriptionFromAPI(text, currentTranscriptionMode);
                displayPhonetics(phonetics);
            }
            
        } catch (error) {
            console.error('Error getting transcription:', error);
            phoneticsOutput.innerHTML = '<div class="error">Error loading transcription. Please try again.</div>';
        }

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
    async function getTranscriptionFromAPI(text, mode) {
        // Check cache first
        const cacheKey = text.toLowerCase().trim();
        if (transcriptionCache[mode][cacheKey]) {
            return transcriptionCache[mode][cacheKey];
        }
        
        let prompt;
        
        if (mode === 'ipa') {
            prompt = `Convert the following English text to International Phonetic Alphabet (IPA) transcription. Return only the transcription without any explanations: "${text}"`;
        } else if (mode === 'arpabet') {
            prompt = `Convert the following English text to ARPAbet transcription. Return only the transcription without any explanations: "${text}"`;
        } else {
            throw new Error('Invalid transcription mode');
        }

        try {
            const response = await fetch(
                `https://text.pollinations.ai/${encodeURIComponent(prompt)}`
            );

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            let transcribedText = await response.text();
            
            // More aggressive cleaning for transcription responses
            transcribedText = transcribedText
                .replace(/^(Sure!|Certainly!|Here's|The|IPA transcription|ARPAbet transcription)[:\s]+/i, '')
                .replace(/^["'](.*)["']$/, '$1')
                .replace(/\.$/, '')
                .trim();
            
            // Cache the result
            transcriptionCache[mode][cacheKey] = transcribedText;
            
            return transcribedText;
            
        } catch (error) {
            console.error('Error calling transcription API:', error);
            throw error;
        }
    }
    function displayPhonetics(phoneticsText) {
        if (currentTranscriptionMode === 'english') {
            // For English mode, show word-by-word highlighting
            phoneticsOutput.innerHTML = words.map((word, index) => {
                const phoneticWord = generatePhonetics(word, false);
                return `<span id="word-${index}" class="english">${phoneticWord}</span>`;
            }).join(' ');
        } else {
            // For IPA and ARPAbet, show the continuous text with appropriate class
            const className = currentTranscriptionMode === 'ipa' ? 'ipa' : 'arpabet';
            phoneticsOutput.innerHTML = `<span class="${className}">${phoneticsText}</span>`;
            
            // Update words array for navigation (split the transcribed text by spaces)
            words = phoneticsText.split(' ');
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

    async function processTextWithPrompt(text) {
        try {
            autoCorrectBtn.textContent = 'Processing...';
            autoCorrectBtn.disabled = true;

            // Get the current prompt template
            const promptTemplate = getCurrentPrompt();
            
            // Replace the {text} placeholder with the actual text
            const prompt = promptTemplate.replace('{text}', text);
            
            const response = await fetch(
                `https://text.pollinations.ai/${encodeURIComponent(prompt)}`
            );

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            let processedText = await response.text();
            
            // EXTRACT ONLY THE MAIN RESPONSE
            // Remove everything after "Optional", "Alternatives", "Variants", etc.
            const stopPatterns = [
                '\nOptional',
                '\nAlternatives',
                '\nVariants',
                '\nOther ways',
                '\nFor example',
                ' Optional',
                ' Alternatives',
                ' Variants'
            ];
            
            for (const pattern of stopPatterns) {
                const index = processedText.indexOf(pattern);
                if (index > -1) {
                    processedText = processedText.substring(0, index);
                }
            }
            
            // Remove common prefixes like "Autocorrected:", "Corrected:", etc.
            const prefixes = [
                "Autocorrected:",
                "Corrected:",
                "Translation:",
                "Definition:",
                "Sure!",
                "Certainly!"
            ];
            
            for (const prefix of prefixes) {
                if (processedText.startsWith(prefix)) {
                    processedText = processedText.substring(prefix.length).trim();
                    // Remove any colon that might follow
                    if (processedText.startsWith(':')) {
                        processedText = processedText.substring(1).trim();
                    }
                    break;
                }
            }
            
            // Extract the first sentence only
            const firstSentenceMatch = processedText.match(/^[^.!?]*[.!?]/);
            if (firstSentenceMatch) {
                processedText = firstSentenceMatch[0].trim();
            }
            
            // Final cleanup
            processedText = processedText.trim();
            
            // Create JSON output
            const jsonOutput = {
                originalText: text,
                processedText: processedText,
                promptUsed: promptTemplate,
                timestamp: new Date().toISOString(),
                success: true
            };
            
            inputText.value = processedText;
            updatePhoneticsDisplay();
            
            // Save to history
            if (currentUser) {
                saveReadToHistory(processedText);
            }
            
            // Return the JSON object
            return jsonOutput;
            
        } catch (error) {
            console.error('Error processing text:', error);
            const errorOutput = {
                originalText: text,
                error: error.message,
                timestamp: new Date().toISOString(),
                success: false
            };
            alert('Failed to process text. Please try again.');
            return errorOutput;
        } finally {
            autoCorrectBtn.textContent = 'Apply Prompt';
            autoCorrectBtn.disabled = false;
        }
    }

=======


=======

    function saveReadToHistory(text) {
        if (!currentUser) {
            console.log("User not logged in, cannot save history");
            return;
        }
        
        // Add a timestamp and trim very long texts
        const historyItem = {
            text: text.length > 500 ? text.substring(0, 500) + "..." : text,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            promptType: promptSelect.value
        };
        
        usersRef(currentUser.uid).collection("history").add(historyItem)
        .then((docRef) => {
            console.log("History item saved with ID: ", docRef.id);
        })
        .catch((error) => {
            console.error("Error saving history: ", error);
        });
    }


    document.getElementById("searchHistory").addEventListener("input", (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll("#historyList li").forEach(li => {
            // Get the text content from the first div (the history text)
            const historyText = li.querySelector('div:first-child').textContent.toLowerCase();
            li.style.display = historyText.includes(term) ? "" : "none";
        });
    });
    
    
    // Set up modal close buttons
    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });

    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
            }
        });
    });
    // Apply filters button
    document.getElementById("applyFiltersBtn").onclick = () => {
        console.log("Applying filters...");
        
        // Start with the base query
        let query = communityRef;
        
        // Apply class filter
        const cls = document.getElementById("filterClass").value;
        if (cls) {
            console.log("Filtering by class:", cls);
            query = query.where("class", "==", cls);
        }
        
        // Apply date range filter
        const start = document.getElementById("filterStart").value;
        const end = document.getElementById("filterEnd").value;
        
        if (start) {
            const startDate = new Date(start);
            startDate.setHours(0, 0, 0, 0); // Start of day
            console.log("Filtering from date:", startDate);
            query = query.where("createdAt", ">=", startDate);
        }
        
        if (end) {
            const endDate = new Date(end);
            endDate.setHours(23, 59, 59, 999); // End of day
            console.log("Filtering to date:", endDate);
            query = query.where("createdAt", "<=", endDate);
        }
        
        // Apply tags filter
        const tagsInput = document.getElementById("filterTags").value;
        const tags = tagsInput.split(",").map(t => t.trim()).filter(t => t);
        
        console.log("Applying filters with query:", query);
        
        // Execute the query
        query.get().then(snapshot => {
            const list = document.getElementById("communityList");
            list.innerHTML = "";
            
            if (snapshot.empty) {
                list.innerHTML = "<li>No community reads match your filters.</li>";
                return;
            }
            
            // If we have tags to filter by, we need to do client-side filtering
            if (tags.length > 0) {
                console.log("Filtering by tags:", tags);
                snapshot.forEach(doc => {
                    const item = doc.data();
                    // Check if any of the filter tags match the item's tags
                    if (tags.some(tag => item.tags && item.tags.includes(tag))) {
                        const li = document.createElement("li");
                        li.textContent = `${item.text} [${item.class}] (${item.tags ? item.tags.join(", ") : "no tags"})`;
                        list.appendChild(li);
                    }
                });
                
                // Check if we found any matches after tag filtering
                if (list.children.length === 0) {
                    list.innerHTML = "<li>No community reads match your tags filter.</li>";
                }
            } else {
                // No tags filter, just display all results
                snapshot.forEach(doc => {
                    const item = doc.data();
                    const li = document.createElement("li");
                    li.textContent = `${item.text} [${item.class}] (${item.tags ? item.tags.join(", ") : "no tags"})`;
                    list.appendChild(li);
                });
            }
        }).catch(error => {
            console.error("Error applying filters:", error);
            document.getElementById("communityList").innerHTML = "<li>Error applying filters. Please check your filter values.</li>";
        });
    };
    // Add to your DOMContentLoaded function
    document.getElementById("refreshHistoryBtn").addEventListener("click", () => {
        console.log("Manual history refresh triggered");
        loadUserData();
    });

    // Add this function if not already implemented
    document.getElementById("clearHistoryBtn").onclick = () => {
        if (!currentUser) {
            alert("You must be logged in to clear history");
            return;
        }
        
        if (!confirm("Are you sure you want to clear all your history? This cannot be undone.")) {
            return;
        }
        
        usersRef(currentUser.uid).collection("history")
        .get().then(snapshot => {
            const batch = db.batch();
            snapshot.forEach(doc => batch.delete(doc.ref));
            return batch.commit();
        })
        .then(() => {
            console.log("All history cleared");
            document.getElementById("historyList").innerHTML = "<li>No history yet. Process some text to see it here.</li>";
        })
        .catch((error) => {
            console.error("Error clearing history: ", error);
            alert("Error clearing history");
        });
    };




    // Event listeners
    autoCorrectBtn.addEventListener('click', async () => {
        const text = inputText.value.trim();
        if (text === '') {
            alert('Please enter some text to process.');
            return;
        }
     
        processTextWithPrompt(text);
    });

=======

        const result = await processTextWithPrompt(text);

        // Optionally log or display the JSON result
        console.log("Processed Result:", result);

        // If you want to show the processed text in phonetics as well:
        updatePhoneticsDisplay();
    });

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

    // Initialize speech recognition and add event listener
    if (microphoneBtn) {
        initSpeechRecognition();
        microphoneBtn.addEventListener('click', toggleRecognition);
    }


    // Initialize button states
    updateButtonStates();
=======
    // Initialize authentication
    initAuth();

    // Initialize button states
    updateButtonStates();

    setupPublishHandler(); 
    loadCommunityReads();

});
=======

});
