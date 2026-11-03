// Bicara PECS Hybrid v1.1 — classic script retained to preserve global handlers.
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js').then(registration => {
                    registration.update();
                }).catch(err => console.log('ServiceWorker gagal didaftarkan: ', err));
            });
        }

        const LOCK_ITERATIONS = 200000;

        function bytesToHex(buf) {
            return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        }

        function hexToBytes(hex) {
            return Uint8Array.from(hex.match(/.{1,2}/g).map(h => parseInt(h, 16)));
        }

        async function derivePinHash(pin, saltHex) {
            const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
            const bits = await crypto.subtle.deriveBits(
                { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: LOCK_ITERATIONS, hash: 'SHA-256' },
                keyMaterial, 256);
            return bytesToHex(bits);
        }

        async function storePin(pin) {
            const saltHex = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
            const hash = await derivePinHash(pin, saltHex);
            localStorage.setItem('pecs_pin_salt', saltHex);
            localStorage.setItem('pecs_pass_hash', hash);
        }

        async function verifyPin(pin) {
            const saltHex = localStorage.getItem('pecs_pin_salt');
            const storedHash = localStorage.getItem('pecs_pass_hash');
            if (!saltHex || !storedHash) return false;
            return (await derivePinHash(pin, saltHex)) === storedHash;
        }

        function updateLastActiveTimestamp() {
            localStorage.setItem('pecs_last_active', Date.now().toString());
        }

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                updateLastActiveTimestamp();
            } else if (document.visibilityState === 'visible' && localStorage.getItem('pecs_lock_type') === 'pin') {
                evaluateAppLock();
            }
        });
        window.addEventListener('beforeunload', updateLastActiveTimestamp);

        function evaluateAppLock() {
            let lockType = localStorage.getItem('pecs_lock_type') || 'unset';
            // Migrasi: data versi lama (sandi default / hash tanpa salt) dipaksa setup ulang.
            if (lockType === 'pin' && !localStorage.getItem('pecs_pin_salt')) lockType = 'unset';
            if (lockType !== 'none' && lockType !== 'pin') lockType = 'unset';
            const lockModal = document.getElementById('lock-screen-modal');
            const lockTitle = document.getElementById('lock-title');
            const lockDesc = document.getElementById('lock-desc');
            const lockForm = document.getElementById('lock-form');
            const setupBtn = document.getElementById('btn-setup-lock');
            const pinInput = document.getElementById('lock-input-pass');

            const show = (title, desc, pinMode, showRestore = false) => {
                lockTitle.innerText = title;
                lockDesc.innerText = desc;
                lockForm.style.display = pinMode ? '' : 'none';
                setupBtn.style.display = pinMode ? 'none' : '';
                document.getElementById('lock-gear').style.display = pinMode ? '' : 'none';
                document.getElementById('btn-restore-lock').style.display = showRestore ? '' : 'none';
                lockModal.style.display = 'flex';
            };

            if (lockType === 'none') {
                lockModal.style.display = 'none';
                return;
            }

            if (lockType === 'unset') {
                show('Atur Kunci Aplikasi', 'Pilih PIN atau tanpa kunci. Sudah punya cadangan? Pulihkan dulu.', false, true);
                return;
            }

            const timeoutMinutes = parseInt(localStorage.getItem('pecs_timeout_min') || '0', 10);
            const lastActive = parseInt(localStorage.getItem('pecs_last_active') || '0', 10);
            const elapsedMinutes = (Date.now() - lastActive) / 60000;
            const shouldLock = timeoutMinutes === 0 || (lastActive > 0 && elapsedMinutes >= timeoutMinutes);

            if (shouldLock) {
                pinInput.value = '';
                show('Kunci PIN Aktif', 'Masukkan PIN Anda untuk melanjutkan.', true);
                pinInput.focus();
                if (getLockoutUntil() > Date.now()) showLockout();
            } else {
                lockModal.style.display = 'none';
            }
        }

        function getLockoutUntil() { return parseInt(localStorage.getItem('pecs_pin_lockout_until') || '0', 10); }
        function getFailCount() { return parseInt(localStorage.getItem('pecs_pin_fails') || '0', 10); }

        function showPopup(id) { document.getElementById(id).classList.add('open'); }
        function hidePopup(id) { document.getElementById(id).classList.remove('open'); }

        function showWrongPin(message) {
            document.getElementById('wrong-pin-text').innerText = message;
            showPopup('wrong-pin-modal');
        }

        function closeWrongPin() {
            hidePopup('wrong-pin-modal');
            document.getElementById('lock-input-pass').focus();
        }

        let lockoutTimer = null;
        function showLockout() {
            showPopup('lockout-modal');
            const countEl = document.getElementById('lockout-count');
            const tick = () => {
                const left = Math.max(0, Math.ceil((getLockoutUntil() - Date.now()) / 1000));
                countEl.innerText = left;
                if (left <= 0) {
                    clearInterval(lockoutTimer);
                    lockoutTimer = null;
                    hidePopup('lockout-modal');
                    document.getElementById('lock-input-pass').focus();
                }
            };
            clearInterval(lockoutTimer);
            tick();
            lockoutTimer = setInterval(tick, 500);
        }

        async function checkUnlockPassword() {
            const input = document.getElementById('lock-input-pass');
            const pin = input.value.trim();
            input.value = '';

            if (getLockoutUntil() > Date.now()) {
                showLockout();
                return;
            }
            if (!/^\d{4,6}$/.test(pin)) {
                showWrongPin('PIN harus terdiri dari 4–6 angka.');
                return;
            }

            if (await verifyPin(pin)) {
                localStorage.setItem('pecs_pin_fails', '0');
                localStorage.removeItem('pecs_pin_lockout_until');
                document.getElementById('lock-screen-modal').style.display = 'none';
                updateLastActiveTimestamp();
                setTimeout(checkMonthlyReminder, 600);
                return;
            }

            const fails = getFailCount() + 1;
            if (fails >= 5) {
                localStorage.setItem('pecs_pin_fails', '0');
                localStorage.setItem('pecs_pin_lockout_until', String(Date.now() + 30000));
                showLockout();
            } else {
                localStorage.setItem('pecs_pin_fails', String(fails));
                showWrongPin(`PIN yang Anda masukkan salah. Sisa percobaan: ${5 - fails} kali.`);
            }
        }

        // ===== Gerbang orang tua: Lupa PIN & Buat PIN Baru =====
        let pgAnswer = 0;

        function openParentGate() {
            hidePopup('lockout-modal');
            const a = 11 + Math.floor(Math.random() * 38);
            const b = 11 + Math.floor(Math.random() * 38);
            pgAnswer = a + b;
            document.getElementById('pg-question').innerText = `${a} + ${b} = ?`;
            document.getElementById('pg-answer').value = '';
            document.getElementById('pg-error').style.display = 'none';
            showPopup('parent-gate-modal');
            document.getElementById('pg-answer').focus();
        }

        function closeParentGate() { hidePopup('parent-gate-modal'); }

        function checkParentGate() {
            const val = parseInt(document.getElementById('pg-answer').value, 10);
            if (val === pgAnswer) {
                hidePopup('parent-gate-modal');
                showPopup('parent-menu-modal');
            } else {
                document.getElementById('pg-error').style.display = 'block';
                document.getElementById('pg-answer').value = '';
            }
        }

        function closeParentMenu() { hidePopup('parent-menu-modal'); }

        function openNewPinForm(mode) {
            hidePopup('parent-menu-modal');
            document.getElementById('np-desc').innerText = mode === 'lupa'
                ? 'Lupa PIN? Buat PIN baru di bawah ini. Kartu, gambar, dan pengaturan tetap aman.'
                : 'Buat PIN baru untuk membuka aplikasi.';
            document.getElementById('np-new').value = '';
            document.getElementById('np-confirm').value = '';
            showPopup('newpin-modal');
            document.getElementById('np-new').focus();
        }

        function closeNewPinForm() { hidePopup('newpin-modal'); }

        async function saveNewPin() {
            const pin = document.getElementById('np-new').value.trim();
            const confirmPin = document.getElementById('np-confirm').value.trim();
            if (!/^\d{4,6}$/.test(pin)) { alert('PIN harus terdiri dari 4–6 angka.'); return; }
            if (pin !== confirmPin) { alert('Konfirmasi PIN tidak cocok. Silakan ketik ulang.'); return; }
            try {
                await storePin(pin);
            } catch (e) {
                alert('PIN belum bisa disimpan. Silakan coba lagi.');
                return;
            }
            localStorage.setItem('pecs_lock_type', 'pin');
            if (!localStorage.getItem('pecs_timeout_min')) localStorage.setItem('pecs_timeout_min', '0');
            localStorage.setItem('pecs_pin_fails', '0');
            localStorage.removeItem('pecs_pin_lockout_until');
            clearInterval(lockoutTimer);
            hidePopup('newpin-modal');
            document.getElementById('lock-screen-modal').style.display = 'none';
            updateLastActiveTimestamp();
            alert('PIN baru sudah disimpan. Simpan PIN ini di tempat yang aman.');
        }

        function openPinConfigModal(isFirstSetup = false) {
            const modal = document.getElementById('pin-config-modal');
            const cancelBtn = document.getElementById('btn-cancel-pin-config');
            const currentLockType = localStorage.getItem('pecs_lock_type') || 'unset';
            const currentTimeout = localStorage.getItem('pecs_timeout_min') || '0';

            if (isFirstSetup) {
                document.getElementById('lock-screen-modal').style.display = 'none';
                if (cancelBtn) cancelBtn.style.display = 'none';
            } else {
                if (cancelBtn) cancelBtn.style.display = 'block';
            }

            const pinRadio = document.querySelector('input[name="lock-mode-choice"][value="pin"]');
            const noneRadio = document.querySelector('input[name="lock-mode-choice"][value="none"]');

            if (currentLockType === 'none') {
                if (noneRadio) noneRadio.checked = true;
                togglePinInputGroup(false);
            } else {
                if (pinRadio) pinRadio.checked = true;
                togglePinInputGroup(true);
            }

            document.getElementById('timeout-select').value = currentTimeout;
            document.getElementById('new-pin-input').value = '';
            document.getElementById('confirm-pin-input').value = '';

            modal.classList.add('open');
        }

        function closePinConfigModal() {
            const lockType = localStorage.getItem('pecs_lock_type') || 'unset';
            if (lockType === 'unset') {
                alert('Anda wajib memilih pengaturan PIN atau Tanpa Kunci untuk melanjutkan.');
                return;
            }
            document.getElementById('pin-config-modal').classList.remove('open');
        }

        function togglePinInputGroup(showPinGroup) {
            const pinGroup = document.getElementById('pin-input-group');
            const timeoutGroup = document.getElementById('timeout-input-group');
            if (showPinGroup) {
                if (pinGroup) pinGroup.style.display = 'block';
                if (timeoutGroup) timeoutGroup.style.display = 'block';
            } else {
                if (pinGroup) pinGroup.style.display = 'none';
                if (timeoutGroup) timeoutGroup.style.display = 'none';
            }
        }

        async function savePinConfiguration() {
            const selectedMode = document.querySelector('input[name="lock-mode-choice"]:checked');
            if (!selectedMode) {
                alert('Pilih salah satu metode keamanan!');
                return;
            }

            const modeValue = selectedMode.value;
            const lockScreen = document.getElementById('lock-screen-modal');

            if (modeValue === 'none') {
                localStorage.setItem('pecs_lock_type', 'none');
                document.getElementById('pin-config-modal').classList.remove('open');
                lockScreen.style.display = 'none';
                alert('Aplikasi sekarang diatur TANPA PIN.');
                return;
            }

            const pinVal = document.getElementById('new-pin-input').value.trim();
            const confirmVal = document.getElementById('confirm-pin-input').value.trim();
            const timeoutVal = document.getElementById('timeout-select').value;

            if (!/^\d{4,6}$/.test(pinVal)) {
                alert('PIN harus terdiri dari 4–6 angka!');
                return;
            }
            if (pinVal !== confirmVal) {
                alert('Konfirmasi PIN tidak cocok! Silakan cek kembali.');
                return;
            }

            await storePin(pinVal);
            localStorage.setItem('pecs_lock_type', 'pin');
            localStorage.setItem('pecs_timeout_min', timeoutVal);
            updateLastActiveTimestamp();
            document.getElementById('pin-config-modal').classList.remove('open');
            lockScreen.style.display = 'none';
            alert('PIN baru berhasil disimpan dan diaktifkan!');
        }

        const idToEnDict = {
            "makan": "eat", "minum": "drink", "minuman": "drink", "makanan": "food",
            "saya": "i", "mau": "want", "minta": "ask", "susu": "milk", "air": "water",
            "nasi": "rice", "roti": "bread", "biskuit": "cookie", "buah": "fruit",
            "permen": "candy", "es krim": "ice cream", "bola": "ball", "mobil": "car",
            "gelembung": "bubbles", "ayunan": "swing", "puzzle": "puzzle", "balok": "blocks",
            "plastisin": "clay", "sendok": "spoon", "gelas": "glass", "piring": "plate",
            "baju": "shirt", "celana": "pants", "sepatu": "shoes", "handuk": "towel",
            "tisu": "tissue", "tas": "bag", "piyama": "pajamas", "tablet": "tablet",
            "musik": "music", "video": "video", "buku": "book", "kamar": "bedroom",
            "toilet": "toilet", "meja": "table", "luar": "outside", "dalam": "inside",
            "sekolah": "school", "rumah": "house", "lapar": "hungry", "haus": "thirsty",
            "sakit": "sick", "capek": "tired", "panas": "hot", "dingin": "cold",
            "bising": "noisy", "gatal": "itchy", "nyaman": "comfortable", "takut": "scared",
            "besar": "big", "kecil": "small", "banyak": "many", "sedikit": "little",
            "merah": "red", "biru": "blue", "kuning": "yellow", "hijau": "green",
            "sekarang": "now", "nanti": "later", "lagi": "again", "selesai": "finish",
            "duduk": "sit", "berdiri": "stand", "tolong": "help", "buka": "open",
            "tutup": "close", "tidur": "sleep", "pipis": "pee", "bab": "poop", "mainan": "toy"
        };


        async function persistCustomImages() {
            try {
                if (window.PecsDB) await window.PecsDB.saveImages(customImages);
                else localStorage.setItem('pecs_custom_images', JSON.stringify(customImages));
            } catch (err) {
                console.error('IndexedDB gagal menyimpan gambar:', err);
                try { localStorage.setItem('pecs_custom_images', JSON.stringify(customImages)); }
                catch (fallbackError) { alert('Gagal menyimpan gambar. Data sebelumnya tidak dihapus. Ekspor cadangan dan kosongkan ruang penyimpanan.'); throw fallbackError; }
            }
        }

        function persistUserCards() {
            // Gambar disimpan terpisah di IndexedDB agar tidak menggandakan base64 di LocalStorage.
            const compactCards = userCards.map(card => {
                const copy = { ...card };
                delete copy.imageUrl;
                return copy;
            });
            localStorage.setItem('pecs_user_cards', JSON.stringify(compactCards));
        }

        function safeGetStorage(key, defaultValue) {
            try {
                const item = localStorage.getItem(key);
                return item !== null ? JSON.parse(item) : defaultValue;
            } catch (e) {
                return defaultValue;
            }
        }

        function escapeHtml(str) {
            return String(str ?? '').replace(/[&<>"']/g, c => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[c]);
        }

        function compressImage(file, callback) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const maxDim = 300;

                    if (width > height) {
                        if (width > maxDim) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        }
                    } else {
                        if (height > maxDim) {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    callback(canvas.toDataURL('image/jpeg', 0.7));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        async function arasaacToCompressed(url) {
            const response = await fetch(url);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const blob = await response.blob();
            return new Promise(resolve => compressImage(blob, resolve));
        }

        const basePecsDatabase = [
            {
                catKey: 'subjek', categoryTitle: '👤 Subjek', type: 'subjek', minLevel: 1,
                items: [
                    { id: 's_saya', word: 'Saya', emoji: { L: '🧒🏻', P: '👧🏻' } },
                    { id: 's_ibu', word: 'Ibu', emoji: '👩🏻' },
                    { id: 's_ayah', word: 'Ayah', emoji: '🧔🏻' },
                    { id: 's_kakak', word: 'Kakak', emoji: '🧑', arasaac: 'older sibling' },
                    { id: 's_adik', word: 'Adik', emoji: '🧒', arasaac: 'younger sibling' },
                    { id: 's_kakek', word: 'Kakek', emoji: '👴', arasaac: 'grandfather' },
                    { id: 's_nenek', word: 'Nenek', emoji: '👵', arasaac: 'grandmother' },
                    { id: 's_terapis', word: 'Terapis', emoji: '🧑‍🏫' },
                    { id: 's_teman', word: 'Teman', emoji: '🧑‍🤝‍🧑' }
                ]
            },
            {
                catKey: 'katakerja', categoryTitle: '🟢 Predikat (Kata Kerja)', type: 'kata-kerja', minLevel: 1,
                items: [
                    { id: 'v_mau', word: 'Mau', emoji: '🤲' },
                    { id: 'v_minta', word: 'Minta', emoji: '🖐️' },
                    { id: 'v_lihat', word: 'Lihat', emoji: '👀' },
                    { id: 'v_makan', word: 'Makan', emoji: '😋', arasaac: 'eat' },
                    { id: 'v_minum', word: 'Minum', emoji: '🥤', arasaac: 'drink' },
                    { id: 'v_main', word: 'Main', emoji: '🎲', arasaac: 'play' },
                    { id: 'v_duduk', word: 'Duduk', emoji: '🧘', arasaac: 'sit' },
                    { id: 'v_berdiri', word: 'Berdiri', emoji: '🧍' },
                    { id: 'v_bantu', word: 'Tolong', emoji: '🆘', arasaac: 'help' },
                    { id: 'v_buka', word: 'Buka', emoji: '📂', arasaac: 'open' },
                    { id: 'v_tutup', word: 'Tutup', emoji: '🔒', arasaac: 'close' },
                    { id: 'v_stop', word: 'Stop', emoji: '✋🏻' },
                    { id: 'v_tidur', word: 'Tidur', emoji: '🛌🏻' },
                    { id: 'v_pipis', word: 'Pipis', emoji: '💧', arasaac: 'urinate' },
                    { id: 'v_bab', word: 'BAB', emoji: '💩', arasaac: 'poop' },
                    { id: 'v_buang_sampah', word: 'Buang Sampah', emoji: '🚮' }
                ]
            },
            {
                catKey: 'benda_makanan', categoryTitle: '🍚 Objek: Makanan & Minuman', type: 'benda', minLevel: 1,
                items: [
                    { id: 'o_air', word: 'Air', emoji: '💧' },
                    { id: 'o_susu', word: 'Susu', emoji: '🥛' },
                    { id: 'o_nasi', word: 'Nasi', emoji: '🍚' },
                    { id: 'o_mie', word: 'Mie', emoji: '🍝' },
                    { id: 'o_pizza', word: 'Pizza', emoji: '🍕' },
                    { id: 'o_roti', word: 'Roti', emoji: '🍞' },
                    { id: 'o_biskuit', word: 'Biskuit', emoji: '🍪' },
                    { id: 'o_permen', word: 'Permen', emoji: '🍬' },
                    { id: 'o_cokelat', word: 'Cokelat', emoji: '🍫' },
                    { id: 'o_eskrim', word: 'Es Krim', emoji: '🍦' }
                ]
            },
            {
                catKey: 'benda_buah', categoryTitle: '🍎 Objek: Buah', type: 'benda', minLevel: 1,
                items: [
                    { id: 'o_anggur', word: 'Anggur', emoji: '🍇' },
                    { id: 'o_melon', word: 'Melon', emoji: '🍈' },
                    { id: 'o_semangka', word: 'Semangka', emoji: '🍉' },
                    { id: 'o_jeruk', word: 'Jeruk', emoji: '🍊' },
                    { id: 'o_lemon', word: 'Lemon', emoji: '🍋' },
                    { id: 'o_pisang', word: 'Pisang', emoji: '🍌' },
                    { id: 'o_nanas', word: 'Nanas', emoji: '🍍' },
                    { id: 'o_apel', word: 'Apel', emoji: '🍎' },
                    { id: 'o_stroberi', word: 'Stroberi', emoji: '🍓' },
                    { id: 'o_kiwi', word: 'Kiwi', emoji: '🥝' },
                    { id: 'o_mangga', word: 'Mangga', emoji: '🥭' }
                ]
            },
            {
                catKey: 'benda_sayur', categoryTitle: '🥦 Objek: Sayur & Lauk', type: 'benda', minLevel: 1,
                items: [
                    { id: 'o_sayuran', word: 'Sayuran', emoji: '🥗' },
                    { id: 'o_wortel', word: 'Wortel', emoji: '🥕' },
                    { id: 'o_timun', word: 'Timun', emoji: '🥒' },
                    { id: 'o_jamur', word: 'Jamur', emoji: '🍄' },
                    { id: 'o_kentang', word: 'Kentang', emoji: '🍟' },
                    { id: 'o_telur', word: 'Telur', emoji: '🥚' },
                    { id: 'o_ikan', word: 'Ikan', emoji: '🐟' },
                    { id: 'o_daging', word: 'Daging', emoji: '🍖' },
                    { id: 'o_udang', word: 'Udang', emoji: '🦐' },
                    { id: 'o_kacang', word: 'Kacang Tanah', emoji: '🥜' }
                ]
            },
            {
                catKey: 'benda_mainan', categoryTitle: '🧸 Objek: Mainan', type: 'benda', minLevel: 1,
                items: [
                    { id: 'o_bola', word: 'Bola', emoji: '⚽' },
                    { id: 'o_mobil', word: 'Mobil', emoji: '🚗' },
                    { id: 'o_perosotan', word: 'Perosotan', emoji: '🛝', arasaac: 'slide' },
                    { id: 'o_puzzle', word: 'Puzzle', emoji: '🧩' },
                    { id: 'o_balok', word: 'Balok', emoji: '🧱', arasaac: 'block' },
                    { id: 'o_robot', word: 'Robot', emoji: '🤖' }
                ]
            },
            {
                catKey: 'benda_harian', categoryTitle: '📦 Objek: Benda Harian', type: 'benda', minLevel: 1,
                items: [
                    { id: 'o_sendok', word: 'Sendok', emoji: '🥄' },
                    { id: 'o_garpu', word: 'Garpu', emoji: '🍴', arasaac: 'fork' },
                    { id: 'o_piring', word: 'Piring', emoji: '🍽️', arasaac: 'plate' },
                    { id: 'o_gelas', word: 'Gelas', emoji: '🥛', arasaac: 'glass' },
                    { id: 'o_baju', word: 'Baju', emoji: '👕' },
                    { id: 'o_celana', word: 'Celana', emoji: '👖' },
                    { id: 'o_sepatu', word: 'Sepatu', emoji: '👟' },
                    { id: 'o_tisu', word: 'Tisu', emoji: '🧻' },
                    { id: 'o_tas', word: 'Tas', emoji: '🎒' }
                ]
            },
            {
                catKey: 'benda_media', categoryTitle: '📱 Objek: Media & Hiburan', type: 'benda', minLevel: 1,
                items: [
                    { id: 'o_hp', word: 'HP', emoji: '📱' },
                    { id: 'o_tv', word: 'TV', emoji: '📺' },
                    { id: 'o_video', word: 'Video', emoji: '🎥' },
                    { id: 'o_foto', word: 'Foto', emoji: '🤳🏻' },
                    { id: 'o_kamera', word: 'Kamera', emoji: '📸' },
                    { id: 'o_musik', word: 'Musik', emoji: '🎵' },
                    { id: 'o_buku', word: 'Buku', emoji: '📖' }
                ]
            },
            {
                catKey: 'tempat', categoryTitle: '📍 Keterangan Tempat', type: 'tempat', minLevel: 3,
                items: [
                    { id: 'k_kamar', word: 'Kamar', emoji: '🛏️' },
                    { id: 'k_toilet', word: 'Toilet', emoji: '🚽' },
                    { id: 'k_meja', word: 'Meja', emoji: '🪑', arasaac: 'table' },
                    { id: 'k_luar', word: 'Di Luar', emoji: '🌳', arasaac: 'outside' },
                    { id: 'k_dalam', word: 'Di Dalam', emoji: '🏠', arasaac: 'inside' },
                    { id: 'k_sekolah', word: 'Sekolah', emoji: '🏫' },
                    { id: 'k_rumah', word: 'Rumah', emoji: '🏡' },
                    { id: 'k_pom_bensin', word: 'Di Pom Bensin', emoji: '⛽' },
                    { id: 'k_bank', word: 'Di Bank', emoji: '🏦' },
                    { id: 'k_masjid', word: 'Di Masjid', emoji: '🕌' },
                    { id: 'k_tempat_sampah', word: 'Di Tempat Sampah', emoji: '🗑️' }
                ]
            },
            {
                catKey: 'perasaan', categoryTitle: '💬 Keterangan Keadaan & Perasaan', type: 'perasaan', minLevel: 3,
                items: [
                    { id: 'ks_lapar', word: 'Lapar', emoji: '🤤', arasaac: 'hungry' },
                    { id: 'ks_haus', word: 'Haus', emoji: '🚰', arasaac: 'thirsty' },
                    { id: 'ks_sakit', word: 'Sakit', emoji: '🤒' },
                    { id: 'ks_capek', word: 'Capek', emoji: '😮‍💨' },
                    { id: 'ks_panas', word: 'Panas', emoji: '🔥', arasaac: 'hot' },
                    { id: 'ks_dingin', word: 'Dingin', emoji: '🧊', arasaac: 'cold' },
                    { id: 'ks_berisik', word: 'Berisik', emoji: '🔊', arasaac: 'noisy' },
                    { id: 'ks_takut', word: 'Takut', emoji: '😣' },
                    { id: 'ks_marah', word: 'Marah', emoji: '😡' },
                    { id: 'ks_sayang', word: 'Sayang', emoji: '🥰' },
                    { id: 'ks_menangis', word: 'Menangis', emoji: '😭' },
                    { id: 'ks_diam', word: 'Diam', emoji: '🫢' },
                    { id: 'ks_sedih', word: 'Sedih', emoji: '😔' },
                    { id: 'ks_suka', word: 'Suka', emoji: '🤩' }
                ]
            },
            {
                catKey: 'sifat', categoryTitle: '🎨 Keterangan Sifat & Warna', type: 'sifat', minLevel: 3,
                items: [
                    { id: 'sa_besar', word: 'Besar', emoji: '🐘', arasaac: 'big' },
                    { id: 'sa_kecil', word: 'Kecil', emoji: '🐭', arasaac: 'small' },
                    { id: 'sa_banyak', word: 'Banyak', emoji: '🔢', arasaac: 'many' },
                    { id: 'sa_sedikit', word: 'Sedikit', emoji: '🤏', arasaac: 'few' },
                    { id: 'sa_merah', word: 'Merah', emoji: '🔴' },
                    { id: 'sa_biru', word: 'Biru', emoji: '🔵' },
                    { id: 'sa_kuning', word: 'Kuning', emoji: '🟡' },
                    { id: 'sa_hijau', word: 'Hijau', emoji: '🟢' }
                ]
            },
            {
                catKey: 'waktu', categoryTitle: '⏱️ Keterangan Waktu & Urutan', type: 'waktu', minLevel: 3,
                items: [
                    { id: 'w_hari_ini', word: 'Hari Ini', emoji: '📅', arasaac: 'today' },
                    { id: 'w_besok', word: 'Besok', emoji: '🔜', arasaac: 'tomorrow' },
                    { id: 'w_kemarin', word: 'Kemarin', emoji: '⏪', arasaac: 'yesterday' },
                    { id: 'w_lagi', word: 'Lagi', emoji: '🔄', arasaac: 'again' },
                    { id: 'w_sudah', word: 'Sudah', emoji: '✅', arasaac: 'done' }
                ]
            },
            {
                catKey: 'jam', categoryTitle: '🕐 Keterangan Jam', type: 'waktu', minLevel: 3,
                items: [
                    { id: 'j_1', word: 'Jam 1', emoji: '🕐' },
                    { id: 'j_2', word: 'Jam 2', emoji: '🕑' },
                    { id: 'j_3', word: 'Jam 3', emoji: '🕒' },
                    { id: 'j_4', word: 'Jam 4', emoji: '🕓' },
                    { id: 'j_5', word: 'Jam 5', emoji: '🕔' },
                    { id: 'j_6', word: 'Jam 6', emoji: '🕕' },
                    { id: 'j_7', word: 'Jam 7', emoji: '🕖' },
                    { id: 'j_8', word: 'Jam 8', emoji: '🕗' },
                    { id: 'j_9', word: 'Jam 9', emoji: '🕘' },
                    { id: 'j_10', word: 'Jam 10', emoji: '🕙' },
                    { id: 'j_11', word: 'Jam 11', emoji: '🕚' },
                    { id: 'j_12', word: 'Jam 12', emoji: '🕛' }
                ]
            }
        ];

        let currentSentence = [];
        let isEditMode = false;
        
        let isChildLock = safeGetStorage('pecs_child_lock', false);
        let isImageOnly = safeGetStorage('pecs_img_only', false);
        let lockClickCount = 0;
        let lockResetTimer = null;
        
        let selectedArasaacUrl = null;
        let editingCardId = null;
        let lastClickTime = 0;
        
        let wordHistory = safeGetStorage('pecs_history', []);
        let userSettings = safeGetStorage('pecs_settings', { level: 1, gender: 'L' });
        let customImages = safeGetStorage('pecs_custom_images', {});
        let customLabels = safeGetStorage('pecs_custom_labels', {});
        let userCards = safeGetStorage('pecs_user_cards', []);
        let deletedCardIds = safeGetStorage('pecs_deleted_cards', []);
        let collapsedCategories = safeGetStorage('pecs_collapsed_cats', {});
        let arasaacCache = safeGetStorage('pecs_arasaac_cache', {});
        const arasaacFetching = new Set();

        function ensureArasaacImages(keywords) {
            const missing = [...keywords].filter(k => !arasaacCache[k] && !arasaacFetching.has(k));
            if (missing.length === 0) return;
            missing.forEach(k => arasaacFetching.add(k));
            Promise.all(missing.map(async k => {
                try {
                    const res = await fetch(`https://api.arasaac.org/v1/pictograms/en/search/${encodeURIComponent(k)}`);
                    if (!res.ok) return false;
                    const list = await res.json();
                    if (!Array.isArray(list) || list.length === 0) return false;
                    const id = list[0]._id;
                    arasaacCache[k] = `https://static.arasaac.org/pictograms/${id}/${id}_300.png`;
                    return true;
                } catch (e) {
                    return false;
                } finally {
                    arasaacFetching.delete(k);
                }
            })).then(results => {
                if (results.some(Boolean)) {
                    localStorage.setItem('pecs_arasaac_cache', JSON.stringify(arasaacCache));
                    renderCategories();
                }
            });
        }

        window.onscroll = function() {
            const btn = document.getElementById('btn-scroll-top');
            if (btn) {
                if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) {
                    btn.style.display = 'block';
                } else {
                    btn.style.display = 'none';
                }
            }
        };

        function scrollToTop() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function goToPage(pageId) {
            const pages = document.querySelectorAll('.page');
            pages.forEach(page => page.classList.remove('active'));
            
            const targetPage = document.getElementById(pageId);
            if (targetPage) {
                targetPage.classList.add('active');
                localStorage.setItem('pecs_active_page', pageId);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }

        function openMenu() {
            document.getElementById('overlay').classList.add('show');
            document.getElementById('sidebar').classList.add('open');
        }

        function closeMenu() {
            document.getElementById('overlay').classList.remove('show');
            document.getElementById('sidebar').classList.remove('open');
        }

        // --- FUNGSI MODAL ABOUT DITAMBAHKAN DI SINI --- //
        // ===== Tema Glass =====
        function applyGlassTheme(on) {
            document.documentElement.classList.toggle('glass-theme', !!on);
            const toggle = document.getElementById('glass-toggle');
            if (toggle) toggle.checked = !!on;
        }

        function toggleGlassTheme(on) {
            applyGlassTheme(on);
            localStorage.setItem('pecs_glass', JSON.stringify(!!on));
        }

        // ===== Pop-up Edit Kartu =====
        let edState = null;

        function findCardInfo(id) {
            for (const cat of basePecsDatabase) {
                const it = cat.items.find(i => i.id === id);
                if (it) return { item: it, defaultWord: it.word };
            }
            const uc = userCards.find(c => c.id === id);
            if (uc) return { item: { id: uc.id, word: uc.word, emoji: '🖼️' }, defaultWord: uc.word };
            return null;
        }

        function defaultEmojiOf(item) {
            return typeof item.emoji === 'object' ? (item.emoji[userSettings.gender] || item.emoji.L) : item.emoji;
        }

        function openEditCardModal(id, event) {
            if (event) event.stopPropagation();
            const info = findCardInfo(id);
            if (!info) return;
            edState = { id: id, info: info, text: customLabels[id] || info.defaultWord, img: customImages[id] || null, imgChanged: false };
            document.getElementById('ed-text').value = edState.text;
            document.getElementById('ed-search-row').style.display = 'none';
            document.getElementById('ed-search-input').value = '';
            document.getElementById('ed-results').innerHTML = '';
            document.getElementById('edit-card-modal').classList.add('open');
            renderEditPreview();
        }

        function closeEditCardModal() {
            document.getElementById('edit-card-modal').classList.remove('open');
            edState = null;
        }

        function renderEditPreview() {
            if (!edState) return;
            const item = edState.info.item;
            const label = (edState.text || '').trim() || edState.info.defaultWord;
            let img = edState.img;
            if (!edState.imgChanged && !img && item.arasaac) img = arasaacCache[item.arasaac] || null;
            const visual = img
                ? `<img src="${img}" class="card-custom-img" alt="">`
                : `<span class="emoji">${defaultEmojiOf(item)}</span>`;
            document.getElementById('ed-preview').innerHTML = `${visual}<span class="word">${escapeHtml(label)}</span>`;
        }

        function edOnTextInput() {
            if (!edState) return;
            edState.text = document.getElementById('ed-text').value;
            renderEditPreview();
        }

        function edResetText() {
            if (!edState) return;
            edState.text = edState.info.defaultWord;
            document.getElementById('ed-text').value = edState.text;
            renderEditPreview();
        }

        function edResetImage() {
            if (!edState) return;
            edState.img = null;
            edState.imgChanged = true;
            renderEditPreview();
        }

        function edOnFile(input) {
            if (!edState || !input.files || !input.files[0]) return;
            compressImage(input.files[0], data => {
                edState.img = data;
                edState.imgChanged = true;
                input.value = '';
                renderEditPreview();
            });
        }

        function edToggleSearch() {
            const row = document.getElementById('ed-search-row');
            row.style.display = row.style.display === 'none' ? 'block' : 'none';
        }

        async function edSearch() {
            const q = document.getElementById('ed-search-input').value.trim().toLowerCase();
            const box = document.getElementById('ed-results');
            if (!q) return;
            box.innerHTML = '<p class="ed-hint">Mencari gambar...</p>';
            try {
                const res = await fetch(`https://api.arasaac.org/v1/pictograms/en/search/${encodeURIComponent(q)}`);
                const list = res.ok ? await res.json() : [];
                box.innerHTML = '';
                if (!Array.isArray(list) || list.length === 0) {
                    box.innerHTML = '<p class="ed-hint">Gambar tidak ditemukan. Coba kata lain.</p>';
                    return;
                }
                list.slice(0, 8).forEach(it => {
                    const url = `https://static.arasaac.org/pictograms/${it._id}/${it._id}_300.png`;
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.className = 'ed-result';
                    const im = document.createElement('img');
                    im.src = url;
                    im.alt = q;
                    b.appendChild(im);
                    b.onclick = () => edPick(url);
                    box.appendChild(b);
                });
            } catch (e) {
                box.innerHTML = '<p class="ed-hint">Gagal terhubung ke server ARASAAC.</p>';
            }
        }

        function edPick(url) {
            if (!edState) return;
            edState.img = url;
            edState.imgChanged = true;
            renderEditPreview();
        }

        function removeCardImage(id) {
            delete customImages[id];
            void persistCustomImages();
            const uc = userCards.find(c => c.id === id);
            if (uc && uc.imageUrl) {
                uc.imageUrl = null;
                persistUserCards();
            }
        }

        async function saveEditCard() {
            if (!edState) return;
            const id = edState.id;
            const text = document.getElementById('ed-text').value.trim();
            if (!text) {
                alert('Tulisan kartu tidak boleh kosong!');
                return;
            }
            try {
                if (edState.imgChanged) {
                    if (edState.img && edState.img.startsWith('https://')) {
                        edState.img = await arasaacToCompressed(edState.img);
                    }
                    if (edState.img) await persistCardImage(id, edState.img);
                    else removeCardImage(id);
                }
                if (text === edState.info.defaultWord) delete customLabels[id];
                else customLabels[id] = text;
                localStorage.setItem('pecs_custom_labels', JSON.stringify(customLabels));
            } catch (err) {
                console.error('Gagal menyimpan kartu:', err);
                alert('Gagal menyimpan. Periksa koneksi atau ruang penyimpanan, lalu coba lagi.');
                return;
            }
            closeEditCardModal();
            renderCategories();
        }

        function deleteFromEditModal() {
            if (!edState) return;
            const id = edState.id;
            closeEditCardModal();
            deleteCard(id, null);
        }

        // ===== Cadangan & Pulihkan Data =====
        const BACKUP_APP = 'BicaraPECS';
        const BACKUP_SKIP_KEYS = ['pecs_last_active', 'pecs_reminder_month'];

        function openBackupModal() {
            document.getElementById('backup-modal').classList.add('open');
        }

        function closeBackupModal() {
            document.getElementById('backup-modal').classList.remove('open');
        }

        async function collectBackupData() {
            const data = {};
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('pecs_') && !BACKUP_SKIP_KEYS.includes(k)) data[k] = localStorage.getItem(k);
            }

            // Gambar: gabungkan IndexedDB dengan kondisi aplikasi saat ini, lalu validasi setiap entri.
            let stored = {};
            if (window.PecsDB) {
                try {
                    stored = (await window.PecsDB.exportImages()) || {};
                } catch (err) {
                    throw new Error('Gambar tidak dapat dibaca dari penyimpanan. Cadangan dibatalkan. Detail: ' + err.message);
                }
            }
            const merged = { ...stored };
            Object.keys(customImages || {}).forEach(id => { if (!merged[id]) merged[id] = customImages[id]; });
            const broken = Object.keys(merged).filter(id => {
                const v = merged[id];
                return typeof v !== 'string' || !(v.startsWith('data:image/') || v.startsWith('https://'));
            });
            if (broken.length) {
                throw new Error(`Gambar untuk ${broken.length} kartu rusak atau kosong (${broken.slice(0, 3).join(', ')}). Cadangan dibatalkan agar tidak menghasilkan file yang tidak lengkap.`);
            }
            const imageCount = Object.keys(merged).length;
            if (imageCount) data['pecs_custom_images'] = JSON.stringify(merged);

            return {
                app: BACKUP_APP,
                version: 3,
                created: new Date().toISOString(),
                counts: { cards: userCards.length, images: imageCount },
                data: data
            };
        }

        function backupFileName() {
            const d = new Date();
            const p = n => String(n).padStart(2, '0');
            return `BicaraPECS-cadangan-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
        }

        async function backupData() {
            const backupDataObject = await collectBackupData();
            const file = new File([JSON.stringify(backupDataObject, null, 2)], backupFileName(), { type: 'application/json' });
            try {
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], title: 'Cadangan Bicara PECS', text: 'Cadangan data Bicara PECS' });
                    closeBackupModal();
                    return;
                }
            } catch (e) {
                if (e && e.name === 'AbortError') return; // dibatalkan pengguna
            }
            const url = URL.createObjectURL(file);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1500);
            closeBackupModal();
            alert('Cadangan sudah disimpan ke folder Unduhan. Pindahkan file tersebut ke Google Drive atau tempat aman lainnya.');
        }

        async function restoreFromFile(input) {
            const file = input.files && input.files[0];
            input.value = '';
            if (!file) return;

            let backup;
            try {
                backup = JSON.parse(await file.text());
            } catch (e) {
                alert('File tidak bisa dibaca. Pastikan Anda memilih file cadangan Bicara PECS (berakhiran .json).');
                return;
            }
            if (!backup || backup.app !== BACKUP_APP || !backup.data || typeof backup.data !== 'object') {
                alert('File ini bukan file cadangan Bicara PECS.');
                return;
            }
            if (typeof backup.version === 'number' && backup.version > 3) {
                alert('Cadangan ini dibuat oleh versi aplikasi yang lebih baru. Perbarui aplikasi terlebih dahulu.');
                return;
            }

            // 1. Validasi isi sebelum menyentuh data yang ada.
            const data = {};
            Object.keys(backup.data).forEach(k => {
                if (k.startsWith('pecs_') && typeof backup.data[k] === 'string' && !BACKUP_SKIP_KEYS.includes(k)) data[k] = backup.data[k];
            });
            if (Object.keys(data).length === 0) {
                alert('File cadangan ini kosong.');
                return;
            }

            let cards, images;
            try {
                cards = data.pecs_user_cards ? JSON.parse(data.pecs_user_cards) : [];
                images = data.pecs_custom_images ? JSON.parse(data.pecs_custom_images) : {};
                if (!Array.isArray(cards) || !images || typeof images !== 'object' || Array.isArray(images)) throw new Error('format');
            } catch (e) {
                alert('Isi cadangan rusak (data kartu atau gambar tidak terbaca). Pemulihan dibatalkan, data Anda tidak berubah.');
                return;
            }

            // Kompatibilitas cadangan versi lama: gambar kartu masih tersimpan di dalam data kartu.
            cards.forEach(c => { if (c && c.id && c.imageUrl && !images[c.id]) images[c.id] = c.imageUrl; });
            const cleanCards = cards.filter(c => c && c.id).map(c => { const x = { ...c }; delete x.imageUrl; return x; });

            const badEntry = Object.keys(images).find(id => {
                const v = images[id];
                return typeof v !== 'string' || !(v.startsWith('data:image/') || v.startsWith('https://'));
            });
            if (badEntry) {
                alert(`Gambar untuk kartu "${badEntry}" rusak atau kosong. Pemulihan dibatalkan, data Anda tidak berubah.`);
                return;
            }
            const imageCount = Object.keys(images).length;

            if (!confirm(`Pulihkan ${cleanCards.length} kartu dan ${imageCount} gambar dari cadangan ini?\n\nKartu dan gambar yang ada sekarang akan diganti. Data lama disimpan sementara dan akan dikembalikan otomatis jika pemulihan gagal.`)) return;

            // 2. Simpan salinan data lama untuk pemulihan jika terjadi kegagalan.
            const oldLS = {};
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('pecs_')) oldLS[k] = localStorage.getItem(k);
            }
            let oldImages;
            try {
                oldImages = window.PecsDB ? ((await window.PecsDB.exportImages()) || {}) : (JSON.parse(oldLS.pecs_custom_images || '{}'));
            } catch (e) {
                alert('Gambar yang ada sekarang tidak bisa dibaca, sehingga pemulihan dibatalkan demi keamanan data Anda.');
                return;
            }

            // 3. Tulis, verifikasi, lalu rollback bila gagal.
            try {
                if (window.PecsDB) {
                    await window.PecsDB.importImages(images);
                    const readBack = await window.PecsDB.exportImages();
                    if (JSON.stringify(readBack) !== JSON.stringify(images)) throw new Error('Verifikasi gambar gagal.');
                } else {
                    localStorage.setItem('pecs_custom_images', JSON.stringify(images));
                }
                Object.keys(oldLS).forEach(k => localStorage.removeItem(k));
                Object.keys(data).forEach(k => {
                    if (k !== 'pecs_custom_images') localStorage.setItem(k, data[k]);
                });
                localStorage.setItem('pecs_user_cards', JSON.stringify(cleanCards));
                const verifyCards = JSON.parse(localStorage.getItem('pecs_user_cards') || '[]');
                if (verifyCards.length !== cleanCards.length) throw new Error('Verifikasi kartu gagal.');
            } catch (err) {
                console.error('Pemulihan gagal, mengembalikan data lama:', err);
                try {
                    if (window.PecsDB) await window.PecsDB.importImages(oldImages);
                    Object.keys(data).forEach(k => localStorage.removeItem(k));
                    Object.keys(oldLS).forEach(k => localStorage.setItem(k, oldLS[k]));
                } catch (rbErr) {
                    console.error('Pengembalian data lama gagal:', rbErr);
                }
                alert('Pemulihan belum berhasil. Data lama sudah dikembalikan. Coba lagi, atau hubungi pendamping.');
                return;
            }

            alert(`Data berhasil dipulihkan: ${cleanCards.length} kartu dan ${imageCount} gambar. Aplikasi akan dibuka ulang.`);
            location.reload();
        }

        // ===== Pengingat cadangan setiap tanggal 1 =====
        function checkMonthlyReminder() {
            const lockModal = document.getElementById('lock-screen-modal');
            if (lockModal && lockModal.style.display === 'flex') return;
            const now = new Date();
            if (now.getDate() !== 1) return;
            const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            if (localStorage.getItem('pecs_reminder_month') === monthKey) return;
            if (!localStorage.getItem('pecs_settings')) return; // belum pernah dipakai
            localStorage.setItem('pecs_reminder_month', monthKey);
            document.getElementById('reminder-modal').classList.add('open');
        }

        function closeReminder() {
            document.getElementById('reminder-modal').classList.remove('open');
        }

        function reminderBackupNow() {
            closeReminder();
            openBackupModal();
        }

        function openAboutModal() {
            document.getElementById('about-modal').classList.add('open');
        }

        function closeAboutModal() {
            document.getElementById('about-modal').classList.remove('open');
        }
        // ---------------------------------------------- //

        function changeTheme(theme) {
            if (theme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
            localStorage.setItem('pecs_theme', theme);
        }

        function toggleEditMode() {
            isEditMode = !isEditMode;
            const btn = document.getElementById('edit-toggle-btn');
            const mainPage = document.getElementById('page-main');

            if (isEditMode) {
                btn.classList.add('active-mode');
                btn.innerHTML = '✅ Selesai';
                mainPage.classList.add('is-edit-mode');
            } else {
                btn.classList.remove('active-mode');
                btn.innerHTML = '⚙️ Edit';
                mainPage.classList.remove('is-edit-mode');
            }
        }

        function toggleImageOnlyModeFromMenu() {
            isImageOnly = !isImageOnly;
            localStorage.setItem('pecs_img_only', JSON.stringify(isImageOnly));
            updateImageOnlyState();
        }

        function updateImageOnlyState() {
            const toggle = document.getElementById('img-only-toggle');
            if (toggle) toggle.checked = isImageOnly;
            document.body.classList.toggle('image-only-mode', isImageOnly);
        }

        async function handleLockClick() {
            lockClickCount++;
            const lockBtn = document.getElementById('lock-btn');
            
            if (lockClickCount < 3) {
                if (lockBtn) lockBtn.innerText = `🔒 Tekan ${3 - lockClickCount}x lagi`;
                clearTimeout(lockResetTimer);
                lockResetTimer = setTimeout(() => {
                    lockClickCount = 0;
                    updateChildLockUI();
                }, 2000);
                return;
            }

            lockClickCount = 0;
            clearTimeout(lockResetTimer);
            if (isChildLock && localStorage.getItem('pecs_lock_type') === 'pin') {
                const entered = prompt('Masukkan PIN untuk membuka kunci anak:');
                if (entered === null) return;
                if (!(await verifyPin(entered.trim()))) {
                    alert('PIN salah.');
                    return;
                }
            }
            isChildLock = !isChildLock;
            localStorage.setItem('pecs_child_lock', JSON.stringify(isChildLock));
            updateChildLockUI();
        }

        function updateChildLockUI() {
            const lockBtn = document.getElementById('lock-btn');
            if (isChildLock) {
                document.body.classList.add('child-locked');
                if (isEditMode) toggleEditMode();
                if (lockBtn) {
                    lockBtn.innerHTML = '🔓 Buka (3x)';
                    lockBtn.classList.add('unlocked-style');
                }
            } else {
                document.body.classList.remove('child-locked');
                if (lockBtn) {
                    lockBtn.innerHTML = '🔒 Kunci (3x)';
                    lockBtn.classList.remove('unlocked-style');
                }
            }
        }

        function toggleCategoryCollapse(catKey) {
            collapsedCategories[catKey] = !collapsedCategories[catKey];
            localStorage.setItem('pecs_collapsed_cats', JSON.stringify(collapsedCategories));
            renderCategories();
        }

        function saveSettingsAndStart() {
            const selectedRadio = document.querySelector('input[name="level"]:checked');
            const selectedLevel = selectedRadio ? parseInt(selectedRadio.value) : 1;
            const selectedGender = document.getElementById('select-gender').value;

            userSettings = { level: selectedLevel, gender: selectedGender };
            localStorage.setItem('pecs_settings', JSON.stringify(userSettings));

            renderCategories();
            goToPage('page-main');
        }

        function renderCategories() {
            const container = document.getElementById('categories-container');
            if (!container) return;
            container.innerHTML = '';
            const pendingArasaac = new Set();

            let activeDatabase = JSON.parse(JSON.stringify(basePecsDatabase));

            if (Array.isArray(userCards)) {
                userCards.forEach(uCard => {
                    const targetCat = activeDatabase.find(c => c.catKey === uCard.catKey);
                    if (targetCat) {
                        targetCat.items.push({
                            id: uCard.id,
                            word: uCard.word,
                            emoji: '🖼️',
                            isUserCreated: true
                        });
                        if (uCard.imageUrl) {
                            customImages[uCard.id] = uCard.imageUrl;
                        }
                    }
                });
            }

            activeDatabase.forEach(cat => {
                if (cat.minLevel <= userSettings.level) {
                    const filteredItems = cat.items.filter(item => !deletedCardIds.includes(item.id));

                    if (filteredItems.length === 0) return;

                    const isCollapsed = !!collapsedCategories[cat.catKey];
                    const catSection = document.createElement('div');
                    catSection.className = `category ${isCollapsed ? 'collapsed' : ''}`;

                    const header = document.createElement('div');
                    header.className = 'category-header';
                    header.innerHTML = `
                        <h3>${cat.categoryTitle}</h3>
                        <label class="cat-switch-wrap hide-on-lock">
                            <span>${isCollapsed ? 'Disembunyikan' : 'Tampilkan'}</span>
                            <span class="switch"><input type="checkbox" ${isCollapsed ? '' : 'checked'} onchange="toggleCategoryCollapse('${cat.catKey}')"><span class="slider"></span></span>
                        </label>
                    `;
                    catSection.appendChild(header);

                    const grid = document.createElement('div');
                    grid.className = 'grid';

                    filteredItems.forEach(item => {
                        let defaultEmoji = item.emoji;
                        if (typeof item.emoji === 'object') {
                            defaultEmoji = item.emoji[userSettings.gender] || item.emoji['L'];
                        }

                        const displayWord = customLabels[item.id] || item.word;
                        const safeDisplayWord = escapeHtml(displayWord);

                        const card = document.createElement('button');
                        card.type = 'button';
                        card.setAttribute('aria-label', displayWord);
                        card.className = `pecs-card ${cat.type}`;
                        card.id = `card_node_${item.id}`;
                        
                        const hasCustomImg = !!customImages[item.id];
                        const arasaacUrl = item.arasaac ? arasaacCache[item.arasaac] : null;
                        const imgUrl = customImages[item.id] || arasaacUrl || null;
                        if (!imgUrl && item.arasaac) pendingArasaac.add(item.arasaac);
                        const fallbackHtml = escapeHtml(`<span class="emoji">${defaultEmoji}</span>`);
                        const visualContent = imgUrl
                            ? `<img src="${imgUrl}" class="card-custom-img" alt="${safeDisplayWord}" data-fb="${fallbackHtml}" onerror="this.outerHTML=this.dataset.fb">`
                            : `<span class="emoji">${defaultEmoji}</span>`;

                        card.onclick = (e) => {
                            if (!isEditMode) {
                                triggerCardFlash(`card_node_${item.id}`);
                                addToSentence(displayWord, defaultEmoji, imgUrl);
                            }
                        };

                        card.innerHTML = `
                            ${visualContent}
                            <span class="word">${safeDisplayWord}</span>
                            <button type="button" class="card-gear" title="Edit kartu" aria-label="Edit kartu ${safeDisplayWord}" onclick="openEditCardModal('${item.id}', event)">⚙️</button>
                        `;
                        grid.appendChild(card);
                    });

                    catSection.appendChild(grid);
                    container.appendChild(catSection);
                }
            });
            ensureArasaacImages(pendingArasaac);
        }

        function triggerCardFlash(elementId) {
            const elem = document.getElementById(elementId);
            if (elem) {
                elem.classList.add('card-active-flash');
                setTimeout(() => elem.classList.remove('card-active-flash'), 250);
            }
        }

        function deleteCard(itemId, event) {
            if (event) event.stopPropagation();
            const confirmDelete = confirm('Apakah Anda yakin ingin menghapus kartu ini?');
            if (confirmDelete) {
                if (Array.isArray(userCards) && userCards.some(uc => uc.id === itemId)) {
                    userCards = userCards.filter(c => c.id !== itemId);
                    persistUserCards();
                } else {
                    if (!deletedCardIds.includes(itemId)) {
                        deletedCardIds.push(itemId);
                        localStorage.setItem('pecs_deleted_cards', JSON.stringify(deletedCardIds));
                    }
                }
                
                delete customImages[itemId];
                delete customLabels[itemId];
                void persistCustomImages();
                localStorage.setItem('pecs_custom_labels', JSON.stringify(customLabels));

                renderCategories();
            }
        }

        function openAddCardModal() {
            editingCardId = null;
            document.getElementById('modal-card-title').innerText = "➕ Tambah Kartu PECS Baru";
            document.getElementById('modal-cat-group').style.display = "block";
            document.getElementById('modal-text-group').style.display = "block";
            document.getElementById('btn-save-card').innerText = "Simpan Kartu";
            document.getElementById('add-card-modal').classList.add('open');
        }

        function closeAddCardModal() {
            document.getElementById('add-card-modal').classList.remove('open');
            document.getElementById('new-card-text').value = '';
            document.getElementById('new-card-file').value = '';
            document.getElementById('arasaac-search-input').value = '';
            document.getElementById('arasaac-results').innerHTML = '';
            selectedArasaacUrl = null;
            editingCardId = null;
        }

        function quickCategorySearch(keyword) {
            document.getElementById('arasaac-search-input').value = keyword;
            searchArasaac();
        }

        async function searchArasaac() {
            const rawQuery = document.getElementById('arasaac-search-input').value.trim().toLowerCase();
            const resultsContainer = document.getElementById('arasaac-results');
            if (!rawQuery) {
                alert('Masukkan kata kunci pencarian!');
                return;
            }

            const query = idToEnDict[rawQuery] || rawQuery;
            resultsContainer.innerHTML = '<p style="grid-column: span 4; font-size:0.85rem; text-align:center; color:var(--text-color);">Mencari piktogram...</p>';

            try {
                let response = await fetch(`https://api.arasaac.org/v1/pictograms/en/search/${encodeURIComponent(query)}`);
                let data = await response.json();

                if (!Array.isArray(data) || data.length === 0) {
                    response = await fetch(`https://api.arasaac.org/v1/pictograms/id/search/${encodeURIComponent(rawQuery)}`);
                    data = await response.json();
                }

                if (!Array.isArray(data) || data.length === 0) {
                    resultsContainer.innerHTML = '<p style="grid-column: span 4; font-size:0.85rem; text-align:center; color:#ef4444;">Gambar tidak ditemukan. Coba kata lain.</p>';
                    return;
                }

                resultsContainer.innerHTML = '';
                data.slice(0, 8).forEach(item => {
                    const imgUrl = `https://static.arasaac.org/pictograms/${item._id}/${item._id}_300.png`;
                    const imgElem = document.createElement('img');
                    imgElem.src = imgUrl;
                    imgElem.style.width = '100%';
                    imgElem.style.aspectRatio = '1/1';
                    imgElem.style.objectFit = 'contain';
                    imgElem.style.border = '2px solid var(--card-border)';
                    imgElem.style.borderRadius = '8px';
                    imgElem.style.cursor = 'pointer';
                    imgElem.style.background = '#fff';

                    imgElem.onclick = () => {
                        document.querySelectorAll('#arasaac-results img').forEach(el => el.style.borderColor = 'var(--card-border)');
                        imgElem.style.borderColor = 'var(--primary)';
                        selectedArasaacUrl = imgUrl;
                    };

                    resultsContainer.appendChild(imgElem);
                });
            } catch (err) {
                console.error('Gagal mengambil gambar ARASAAC:', err);
                resultsContainer.innerHTML = '<p style="grid-column: span 4; font-size:0.85rem; text-align:center; color:#ef4444;">Gagal terhubung ke server ARASAAC.</p>';
            }
        }

        async function persistCardImage(id, img) {
            customImages[id] = img;
            await persistCustomImages();
            const uc = userCards.find(c => c.id === id);
            if (uc) {
                uc.imageUrl = img;
                persistUserCards();
            }
        }

        async function submitNewCustomCard() {
            const catKey = document.getElementById('new-card-category').value;
            const textVal = document.getElementById('new-card-text').value.trim();
            const fileInput = document.getElementById('new-card-file');
            const hasFile = fileInput.files && fileInput.files.length > 0;

            if (!selectedArasaacUrl && !hasFile) {
                alert('Pilih piktogram ARASAAC atau upload gambar terlebih dahulu!');
                return;
            }

            let img;
            try {
                img = selectedArasaacUrl
                    ? await arasaacToCompressed(selectedArasaacUrl)
                    : await new Promise(resolve => compressImage(fileInput.files[0], resolve));
            } catch (e) {
                console.error('Gagal memproses gambar:', e);
                alert('Gagal memuat gambar. Periksa koneksi lalu coba lagi.');
                return;
            }

            if (editingCardId) {
                await persistCardImage(editingCardId, img);
                closeAddCardModal();
                renderCategories();
                return;
            }

            if (!textVal) {
                alert('Tulisan/Label kartu tidak boleh kosong!');
                return;
            }
            await saveCardToStorage(catKey, textVal, img);
        }

        async function saveCardToStorage(catKey, textVal, imageUrl) {
            const newId = 'custom_card_' + Date.now();
            const newCardObj = { id: newId, catKey: catKey, word: textVal };
            const previousCards = userCards;
            const previousImages = { ...customImages };
            userCards = [...userCards, newCardObj];
            customImages[newId] = imageUrl;
            try {
                // Gambar wajib tersimpan dan terverifikasi di IndexedDB sebelum kartu dianggap tersimpan.
                await persistCustomImages();
                persistUserCards();
            } catch (err) {
                console.error('Gagal menyimpan kartu baru:', err);
                userCards = previousCards;
                customImages = previousImages;
                alert('Kartu belum tersimpan karena memori penuh atau penyimpanan gagal. Coba lagi setelah ruang penyimpanan dikosongkan.');
                return;
            }
            closeAddCardModal();
            renderCategories();
            alert('Kartu PECS baru berhasil ditambahkan!');
        }

        function resetToDefaultSettings() {
            const confirmReset = confirm('Apakah Anda yakin ingin menghapus semua kustomisasi dan mengembalikan ke pengaturan awal?');
            if (confirmReset) {
                Object.keys(localStorage).filter(k => k.startsWith('pecs_')).forEach(k => localStorage.removeItem(k));
                if (window.PecsDB) window.PecsDB.clear().catch(err => console.error('Gagal menghapus IndexedDB:', err));
                alert('Aplikasi telah dikembalikan ke pengaturan awal.');
                window.location.reload();
            }
        }

        function addToSentence(word, emoji, customImgUrl) {
            const currentTime = new Date().getTime();
            if (currentTime - lastClickTime < 400) return; 
            lastClickTime = currentTime;

            currentSentence.push({ word, emoji, customImgUrl });
            saveToHistory(word);
            updateSentenceStrip();
            speakText(word);
        }

        function updateSentenceStrip() {
            const strip = document.getElementById('sentence-strip');
            if (!strip) return;

            if (currentSentence.length === 0) {
                strip.innerHTML = '<span style="color: #94a3b8; width: 100%; text-align: center; font-size: 0.95rem;" class="placeholder-text">Ketuk gambar di bawah untuk menyusun kalimat...</span>';
                return;
            }

            strip.innerHTML = '';
            currentSentence.forEach((item, index) => {
                const elem = document.createElement('div');
                elem.className = 'sentence-item';
                elem.onclick = () => removeFromSentence(index);

                const visualContent = item.customImgUrl 
                    ? `<img src="${item.customImgUrl}" class="card-custom-img" alt="${escapeHtml(item.word)}">`
                    : `<span class="emoji">${item.emoji}</span>`;

                elem.innerHTML = `
                    <span class="item-remove-btn" title="Hapus kata ini">×</span>
                    ${visualContent}
                    <span class="word"></span>
                `;
                elem.querySelector('.word').textContent = item.word;
                strip.appendChild(elem);
            });
        }

        function removeFromSentence(index) {
            currentSentence.splice(index, 1);
            updateSentenceStrip();
        }

        function clearSentence() {
            currentSentence = [];
            updateSentenceStrip();
        }

        function speakSentence() {
            if (currentSentence.length === 0) return;
            const teksBicara = currentSentence.map(item => item.word).join(" ");
            speakText(teksBicara);
        }

        function speakText(text) {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'id-ID';
                const idVoice = window.speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('id'));
                if (idVoice) utterance.voice = idVoice;
                utterance.rate = 0.85;
                window.speechSynthesis.speak(utterance);
            }
        }

        function saveToHistory(word) {
            const now = new Date().getTime();
            wordHistory.unshift({ word, timestamp: now });
            wordHistory = wordHistory.filter(item => (now - item.timestamp) < 86400000);
            localStorage.setItem('pecs_history', JSON.stringify(wordHistory));
        }

        function renderHistory() {
            const historyList = document.getElementById('history-list');
            if (!historyList) return;

            const now = new Date().getTime();
            wordHistory = wordHistory.filter(item => (now - item.timestamp) < 86400000);
            
            if (wordHistory.length === 0) {
                historyList.innerHTML = '<p style="text-align:center; color:#94a3b8;">Belum ada riwayat kata hari ini.</p>';
                return;
            }

            historyList.innerHTML = wordHistory.map(item => {
                const date = new Date(item.timestamp);
                const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                return `
                    <div class="history-item">
                        <span class="word">${escapeHtml(item.word)}</span>
                        <span class="time">${timeStr}</span>
                    </div>
                `;
            }).join('');
        }

        // ===== Modul Card Generator: membaca database lama tanpa mengubah data sumber =====
        let generatorSelectedIds = new Set();

        function getGeneratorCards() {
            const cards = [];
            const db = JSON.parse(JSON.stringify(basePecsDatabase));
            userCards.forEach(card => {
                const category = db.find(cat => cat.catKey === card.catKey);
                if (category) category.items.push({ id: card.id, word: card.word, emoji: '🖼️', imageUrl: card.imageUrl || null, isCustom: true });
            });
            db.forEach(cat => cat.items.forEach(item => {
                if (deletedCardIds.includes(item.id)) return;
                const word = customLabels[item.id] || item.word;
                const emoji = typeof item.emoji === 'object' ? (item.emoji[userSettings.gender] || item.emoji.L || '🗣️') : (item.emoji || '🗣️');
                const image = customImages[item.id] || item.imageUrl || (item.arasaac ? arasaacCache[item.arasaac] : null);
                cards.push({ id: item.id, catKey: cat.catKey, category: cat.categoryTitle, word, emoji, image });
            }));
            return cards;
        }

        function renderCardGenerator() {
            const select = document.getElementById('generator-category');
            const list = document.getElementById('generator-card-list');
            if (!select || !list) return;
            const cards = getGeneratorCards();
            const current = select.value || 'all';
            const categories = [...new Map(cards.map(c => [c.catKey, { value:c.catKey, label:c.category }])).values()];
            select.innerHTML = '<option value="all">Semua kategori</option>' + categories.map(c => `<option value="${escapeHtml(c.value)}">${escapeHtml(c.label)}</option>`).join('');
            select.value = categories.some(c => c.value === current) || current === 'all' ? current : 'all';
            const filtered = select.value === 'all' ? cards : cards.filter(c => c.catKey === select.value);
            list.innerHTML = '';
            filtered.forEach(card => {
                const label = document.createElement('label');
                label.className = 'generator-option';
                const checked = generatorSelectedIds.has(card.id) ? 'checked' : '';
                const visual = card.image ? `<img src="${escapeHtml(card.image)}" alt="">` : `<span class="gen-emoji">${escapeHtml(card.emoji)}</span>`;
                label.innerHTML = `<input type="checkbox" value="${escapeHtml(card.id)}" ${checked} onchange="updateGeneratorSelection(this)">${visual}<span>${escapeHtml(card.word)}</span>`;
                list.appendChild(label);
            });
            updateGeneratorCount();
        }

        function updateGeneratorSelection(input) {
            if (input.checked) generatorSelectedIds.add(input.value);
            else generatorSelectedIds.delete(input.value);
            updateGeneratorCount();
        }

        function updateGeneratorCount() {
            const count = document.getElementById('generator-count');
            if (count) count.textContent = `${generatorSelectedIds.size} kartu dipilih`;
        }

        function toggleAllGeneratorCards(checked) {
            const category = document.getElementById('generator-category').value;
            getGeneratorCards().filter(c => category === 'all' || c.catKey === category).forEach(c => {
                if (checked) generatorSelectedIds.add(c.id);
                else generatorSelectedIds.delete(c.id);
            });
            renderCardGenerator();
        }

        function updateGeneratorSizeNote() {
            const size = document.getElementById('generator-size').value;
            const grid = document.querySelector('#generator-print-area .print-card-grid');
            if (grid) grid.style.gridTemplateColumns = size === 'small' ? 'repeat(5,1fr)' : 'repeat(4,1fr)';
        }

        function printSelectedCards() {
            const selected = getGeneratorCards().filter(c => generatorSelectedIds.has(c.id));
            if (!selected.length) { alert('Pilih minimal satu kartu terlebih dahulu.'); return; }
            const size = document.getElementById('generator-size').value;
            const area = document.getElementById('generator-print-area');
            const columns = size === 'small' ? 5 : 4;
            area.innerHTML = `<h1 class="print-heading">Kartu Komunikasi — Bicara PECS</h1><div class="print-card-grid" style="grid-template-columns:repeat(${columns},1fr)">${selected.map(card => {
                const visual = card.image ? `<img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.word)}">` : `<div class="print-emoji">${escapeHtml(card.emoji)}</div>`;
                return `<div class="print-card">${visual}<strong>${escapeHtml(card.word)}</strong></div>`;
            }).join('')}</div>`;
            const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
            if (!isStandalone && typeof window.print === 'function') {
                window.print();
                return;
            }
            openPrintableDocument(area.innerHTML);
        }

        // Dokumen cetak terpisah untuk aplikasi terpasang di iOS/Android (pengguna simpan sebagai PDF dari peramban)
        function openPrintableDocument(bodyHtml) {
            const css = `
                @page { size: A4; margin: 10mm; }
                body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color:#111; margin:0; padding:10mm; background:#fff; }
                .print-heading { text-align:center; margin:0 0 6mm; font-size:16pt; }
                .print-card-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:5mm; }
                .print-card { height:42mm; border:1.5px solid #222; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:3mm; box-sizing:border-box; break-inside:avoid; }
                .print-card img { width:25mm; height:25mm; object-fit:contain; }
                .print-card .print-emoji { font-size:25mm; line-height:1.1; }
                .print-card strong { font-size:11pt; margin-top:2mm; }
                @media print { .no-print { display:none; } }`;
            const doc = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kartu Komunikasi - Bicara PECS</title><style>${css}</style></head><body>${bodyHtml}<p class="no-print" style="text-align:center;font-size:12pt;">Tekan ikon Bagikan lalu pilih "Cetak" atau "Simpan ke File" (PDF).</p></body></html>`;
            const blob = new Blob([doc], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const win = window.open(url, '_blank');
            if (!win) {
                const a = document.createElement('a');
                a.href = url;
                a.download = 'Kartu-Komunikasi-BicaraPECS.html';
                document.body.appendChild(a);
                a.click();
                a.remove();
                alert('Kartu disimpan sebagai file HTML. Buka file tersebut lalu pilih Cetak atau Simpan sebagai PDF.');
            }
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        }

        window.onload = async () => {
            try {
                if (window.PecsDB) customImages = await window.PecsDB.initialize();
                let cardsChanged = false;
                userCards.forEach(card => {
                    if (card && card.id && card.imageUrl) {
                        if (!customImages[card.id]) customImages[card.id] = card.imageUrl;
                        delete card.imageUrl;
                        cardsChanged = true;
                    }
                });
                if (cardsChanged) {
                    await persistCustomImages();
                    persistUserCards();
                }
            } catch (storageError) {
                console.error('Inisialisasi IndexedDB gagal; menggunakan data LocalStorage:', storageError);
                customImages = safeGetStorage('pecs_custom_images', {});
                alert('Penyimpanan gambar belum dapat dipindahkan. Aplikasi akan mencoba menggunakan penyimpanan lama. Jangan hapus data browser.');
            }
            const savedTheme = localStorage.getItem('pecs_theme');
            if (savedTheme) {
                const selectTheme = document.getElementById('theme-select');
                if (selectTheme) selectTheme.value = savedTheme;
                changeTheme(savedTheme);
            }

            await evaluateAppLock();

            updateImageOnlyState();
            updateChildLockUI();
            applyGlassTheme(safeGetStorage('pecs_glass', false));

            if (userSettings) {
                const radio = document.querySelector(`input[name="level"][value="${userSettings.level}"]`);
                if (radio) radio.checked = true;
                
                const genderSelect = document.getElementById('select-gender');
                if (genderSelect && userSettings.gender) genderSelect.value = userSettings.gender;
            }

            renderCategories();

            const lastActivePage = localStorage.getItem('pecs_active_page') || 'page-welcome';
            goToPage(lastActivePage);
            setTimeout(checkMonthlyReminder, 600);
        };
    
