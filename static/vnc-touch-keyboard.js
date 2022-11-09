const UI = {

    connected: false,
    desktopName: "",

    statusTimeout: null,
    hideKeyboardTimeout: null,
    idleControlbarTimeout: null,
    closeControlbarTimeout: null,

    controlbarGrabbed: false,
    controlbarDrag: false,
    controlbarMouseDownClientY: 0,
    controlbarMouseDownOffsetY: 0,

    lastKeyboardinput: null,
    defaultKeyboardinputLen: 100,

    inhibitReconnect: true,
    reconnectCallback: null,
    reconnectPassword: null,

    keyboardinputReset() {
        const kbi = document.getElementById('noVNC_keyboardinput');
        kbi.value = new Array(UI.defaultKeyboardinputLen).join("_");
        UI.lastKeyboardinput = kbi.value;
    },

    keyInput(event) {

        if (!rfb) return;
    
        const newValue = event.target.value;
    
        if (!UI.lastKeyboardinput) {
            UI.keyboardinputReset();
        }
        const oldValue = UI.lastKeyboardinput;
    
        let newLen;
        try {
            // Try to check caret position since whitespace at the end
            // will not be considered by value.length in some browsers
            newLen = Math.max(event.target.selectionStart, newValue.length);
        } catch (err) {
            // selectionStart is undefined in Google Chrome
            newLen = newValue.length;
        }
        const oldLen = oldValue.length;
    
        let inputs = newLen - oldLen;
        let backspaces = inputs < 0 ? -inputs : 0;
    
        // Compare the old string with the new to account for
        // text-corrections or other input that modify existing text
        for (let i = 0; i < Math.min(oldLen, newLen); i++) {
            if (newValue.charAt(i) != oldValue.charAt(i)) {
                inputs = newLen - i;
                backspaces = oldLen - i;
                break;
            }
        }
    
        // Send the key events
        for (let i = 0; i < backspaces; i++) {
            rfb.sendKey(KeyTable.XK_BackSpace, "Backspace");
        }
        for (let i = newLen - inputs; i < newLen; i++) {
            rfb.sendKey(keysyms.lookup(newValue.charCodeAt(i)));
        }
    
        // Control the text content length in the keyboardinput element
        if (newLen > 2 * UI.defaultKeyboardinputLen) {
            UI.keyboardinputReset();
        } else if (newLen < 1) {
            // There always have to be some text in the keyboardinput
            // element with which backspace can interact.
            UI.keyboardinputReset();
            // This sometimes causes the keyboard to disappear for a second
            // but it is required for the android keyboard to recognize that
            // text has been added to the field
            event.target.blur();
            // This has to be ran outside of the input handler in order to work
            setTimeout(event.target.focus.bind(event.target), 0);
        } else {
            UI.lastKeyboardinput = newValue;
        }
    },

    onfocusVirtualKeyboard(event) {
        document.getElementById('noVNC_keyboard_button')
            .classList.add("noVNC_selected");
        if (rfb) {
            rfb.focusOnClick = false;
        }
    },
    
    onblurVirtualKeyboard(event) {
        document.getElementById('noVNC_keyboard_button')
            .classList.remove("noVNC_selected");
        if (rfb) {
            rfb.focusOnClick = true;
        }
    },
    
    keyEvent(keysym, code, down) {
        if (!rfb) return;
    
        rfb.sendKey(keysym, code, down);
    },

    showVirtualKeyboard() {
        touchKeyboard = new rfb._keyboard.constructor(document.getElementById('noVNC_keyboardinput'));
        touchKeyboard.onkeyevent = UI.keyEvent;
        touchKeyboard.grab();
        document.getElementById("noVNC_keyboardinput")
                .addEventListener('input', UI.keyInput);
        document.getElementById("noVNC_keyboardinput")
                .addEventListener('focus', UI.onfocusVirtualKeyboard);
        document.getElementById("noVNC_keyboardinput")
                .addEventListener('blur', UI.onblurVirtualKeyboard);
        document.getElementById("noVNC_keyboardinput")
                .addEventListener('submit', () => false);
    },

    hideVirtualKeyboard() {
        if (!isTouchDevice) return;

        const input = document.getElementById('noVNC_keyboardinput');

        if (document.activeElement != input) return;

        input.blur();
    },
};

function toggleVirtualKeyboard() {
    if (document.getElementById('noVNC_keyboard_button')
        .classList.contains("noVNC_selected")) {
        UI.hideVirtualKeyboard();
    } else {
        UI.showVirtualKeyboard();
    }
}

