// التحقق الأمني من الصلاحيات
if (typeof SecurityGuard !== 'undefined') {
    SecurityGuard.verifySession("INSPECTOR");
}

const firebaseConfig = {
  apiKey: "AIzaSyBNBrVpBK8p_WWNwNhSH-mZ6NXOyr2TLhI",
  authDomain: "voyage-touggourt-48755.firebaseapp.com",
  projectId: "voyage-touggourt-48755",
  storageBucket: "voyage-touggourt-48755.firebasestorage.app",
  messagingSenderId: "712694455348",
  appId: "1:712694455348:web:5b4e8df57347edf944fe61"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// ================= حالة النظام والذاكرة المؤقتة =================
const PHOTO_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzSe-P_rRLZ0iiQtC1oB9mAkaNJ3b1r0pUsWpQgPznW4k5mItoMxlPjROd9wpev6rUjBw/exec";
let employeePhotosMap = {};

let html5QrCode = null;
let todayDate = "";
let activeCenter = "";
let scannedCardsCount = 0;

let currentToken = "";
let myDeviceId = "";
let myDeviceModel = "";

function getDeviceModelName() {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) {
        const match = ua.match(/;\s*([^;]+)\s+Build/);
        return match ? match[1].trim() : "هاتف أندرويد";
    }
    if (/iPhone/i.test(ua)) return "iPhone";
    if (/iPad/i.test(ua)) return "iPad";
    if (/Windows/i.test(ua)) return "كمبيوتر Windows";
    if (/Macintosh/i.test(ua)) return "جهاز Mac";
    return "هاتف ذكي";
}

function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const rad = Math.PI / 180;
    const φ1 = lat1 * rad;
    const φ2 = lat2 * rad;
    const Δφ = (lat2 - lat1) * rad;
    const Δλ = (lon2 - lon1) * rad;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

function checkGeofence(centerLat, centerLng, allowedRadius) {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            Swal.fire({
                icon: 'warning',
                title: 'تحديد الموقع الجغرافي',
                text: 'متصفحك لا يدعم تحديد الموقع الجغرافي للتحقق من التواجد داخل مقر المركز.',
                confirmButtonText: 'متابعة'
            }).then(() => resolve());
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                const dist = getDistanceFromLatLonInMeters(userLat, userLng, centerLat, centerLng);
                const roundedDist = Math.round(dist);

                if (dist > allowedRadius) {
                    Swal.fire({
                        icon: 'error',
                        title: 'خارج النطاق الجغرافي للمركز',
                        html: 'أنت تبعد مسافة <b>' + roundedDist + ' متر</b> عن مقر المركز المعتمد.<br>النطاق المسموح به هو <b>' + allowedRadius + ' متر</b> فقط.<br>يرجى التواجد داخل مقر المركز لتسجيل الحضور.',
                        allowOutsideClick: false,
                        showConfirmButton: false
                    });
                } else {
                    console.log('Geofence verified: ' + roundedDist + 'm <= ' + allowedRadius + 'm');
                    resolve();
                }
            },
            (error) => {
                console.warn("GPS error:", error);
                Swal.fire({
                    icon: 'warning',
                    title: 'تنبيه الموقع الجغرافي',
                    text: 'تعذر تحديد موقعك الجغرافي للتحقق من التواجد داخل المركز. يرجى تفعيل الـ GPS والسماح بالإذن.',
                    confirmButtonText: 'متابعة'
                }).then(() => resolve());
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });
}

function captureCameraSnapshot(quality = 0.55, maxWidth = 360) {
    try {
        const video = document.querySelector("#reader video");
        if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;
        const canvas = document.createElement("canvas");
        let w = video.videoWidth;
        let h = video.videoHeight;
        if (w > maxWidth) {
            h = Math.round((h * maxWidth) / w);
            w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, w, h);
        return canvas.toDataURL("image/jpeg", quality);
    } catch (e) {
        console.warn("Snapshot capture error:", e);
        return null;
    }
}

async function recordFirstScanAuditIfNeeded(scannedEmpId) {
    if (!currentToken || !myDeviceId) return;
    try {
        const tokenSnap = await db.collection('scanner_tokens').doc(currentToken).get();
        if (tokenSnap.exists) {
            const data = tokenSnap.data();
            const audits = data.firstScanAudits || {};
            if (!audits[myDeviceId]) {
                const photo = captureCameraSnapshot(0.6, 360);
                if (photo) {
                    await db.collection('scanner_tokens').doc(currentToken).update({
                        ['firstScanAudits.' + myDeviceId]: {
                            capturedAt: new Date().toISOString(),
                            deviceName: myDeviceModel,
                            firstScannedEmpId: String(scannedEmpId || 'عام'),
                            photoData: photo
                        }
                    });
                }
            }
        }
    } catch (e) {
        console.warn("First scan audit error:", e);
    }
}

function incrementTokenScanCounters() {
    if (!currentToken || !myDeviceId) return;
    db.collection('scanner_tokens').doc(currentToken).update({
        totalScans: firebase.firestore.FieldValue.increment(1),
        ['scanCounts.' + myDeviceId]: firebase.firestore.FieldValue.increment(1)
    }).catch(err => console.warn("Counters update warning:", err));
}

function initRemotePhotoListener(tok) {
    let lastHandledReqId = "";
    db.collection('scanner_tokens').doc(tok).onSnapshot(doc => {
        if (!doc.exists) return;
        const data = doc.data();
        if (data.remotePhotoCommand && data.remotePhotoCommand.requested) {
            const cmd = data.remotePhotoCommand;
            if (cmd.requestId && cmd.requestId !== lastHandledReqId) {
                if (cmd.targetDevice === 'all' || cmd.targetDevice === myDeviceId) {
                    lastHandledReqId = cmd.requestId;
                    setTimeout(() => {
                        const photo = captureCameraSnapshot(0.6, 400);
                        if (photo) {
                            db.collection('scanner_tokens').doc(tok).update({
                                ['lastRemotePhotosMap.' + myDeviceId]: {
                                    requestId: cmd.requestId,
                                    deviceName: myDeviceModel,
                                    capturedAt: new Date().toISOString(),
                                    photoUrl: photo
                                }
                            }).catch(e => console.warn("Remote photo update error:", e));
                        }
                    }, 500);
                }
            }
        }
    });
}


// إعدادات التحكم التفاعلي
let isScanningPaused = false;
let isFastScanMode = true; // وضع المسح السريع المتتابع مفعل افتراضياً
let isSoundEnabled = true;
let isTorchOn = false;
let availableCameras = [];
let currentCameraIndex = 0;

// مانع التكرار اللحظي (Debounce)
let lastScannedId = "";
let lastScannedTime = 0;
const DEBOUNCE_DELAY = 1600; // ملي ثانية

// كاش البيانات في الذاكرة لتسريع المسح O(1)
let centerTraineesMap = {}; // empId -> trainee
let centerFramersMap = {};   // empId -> framer
let todayTraineeRecords = {};
let todayFramerRecords = {};
let currentSysModeTrainees = "open";
let currentSysModeFramers = "open";

let quickCardTimer = null;

function extractCoreId(val) {
    if (!val) return "";
    let str = String(val).trim().toUpperCase();
    let digitsOnly = str.replace(/\D/g, "");
    let core = digitsOnly.replace(/^0+/, ""); 
    return core === "" ? digitsOnly : core;
}

// ================= مولد الصوت اللحظي (Web Audio API) =================
function playScanSound(type = 'success') {
    if (!isSoundEnabled) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'success') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
            osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08); // E6
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.2);
        } else if (type === 'warn') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(520, ctx.currentTime);
            osc.frequency.setValueAtTime(440, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.25);
        } else {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, ctx.currentTime);
            gain.gain.setValueAtTime(0.4, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        }
    } catch (e) {
        console.log("Audio Error:", e);
    }
}

function triggerHaptic(type = 'success') {
    if (navigator.vibrate) {
        try {
            if (type === 'success') navigator.vibrate([60]);
            else if (type === 'warn') navigator.vibrate([40, 40, 40]);
            else navigator.vibrate([120, 60, 120]);
        } catch(e) {}
    }
}

// ================= تهيئة الصفحة =================
window.onload = async function() {
    const d = new Date();
    todayDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    document.getElementById("dateInfo").innerText = "جاري التحقق من الصلاحيات وتجهيز الكاش...";

    // 1. استخراج الرمز السري من الرابط
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        Swal.fire({
            icon: 'error', title: 'رابط غير صالح',
            text: 'الرابط غير كامل وينقصه الرمز السري.',
            allowOutsideClick: false, showConfirmButton: false
        });
        return; 
    }

    // 2. جلب الصور في الخلفية
    fetch(`${PHOTO_SCRIPT_URL}?type=employees`).then(async (photoRes) => {
        const responseText = await photoRes.text();
        if (responseText && responseText.includes("[")) {
            const photoData = JSON.parse(responseText);
            photoData.forEach(item => {
                if (item.jobId && item.photoUrl) {
                    const coreJobId = extractCoreId(item.jobId);
                    let directUrl = item.photoUrl;
                    const match = directUrl.match(/id=([a-zA-Z0-9_-]+)/) || directUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                    if (match) directUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w400`;
                    employeePhotosMap[coreJobId] = directUrl;
                }
            });
        }
    }).catch(e => console.warn("تعذر جلب الصور في الخلفية:", e));

    currentToken = token;

    // 3. التحقق من بصمة الجهاز
    myDeviceId = localStorage.getItem('scanner_device_id');
    if (!myDeviceId) {
        myDeviceId = 'DEV_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        localStorage.setItem('scanner_device_id', myDeviceId);
    }
    myDeviceModel = getDeviceModelName();

    try {
        // 4. التحقق من الرمز في Firestore
        let tokenDoc = await db.collection('scanner_tokens').doc(token).get();
        if (!tokenDoc.exists) {
            Swal.fire({
                icon: 'error', title: 'رابط منتهي أو غير صحيح',
                text: 'هذا الرابط غير صالح أو تم إبطاله من قبل رئيس المركز.',
                allowOutsideClick: false, showConfirmButton: false
            });
            return; 
        }

        let tokenData = tokenDoc.data();
        let maxAllowed = parseInt(tokenData.maxDevices) || 1;
        let registeredList = tokenData.registeredDevices || [];

        if (tokenData.registeredDevice && !registeredList.some(d => (typeof d === 'object' ? d.deviceId : d) === tokenData.registeredDevice)) {
            registeredList.push({
                deviceId: tokenData.registeredDevice,
                deviceModel: 'جهاز سابق',
                registeredAt: new Date().toISOString()
            });
        }

        const isAlreadyRegistered = registeredList.some(d => (typeof d === 'object' ? d.deviceId : d) === myDeviceId);

        if (!isAlreadyRegistered) {
            if (registeredList.length >= maxAllowed) {
                Swal.fire({
                    icon: 'error', 
                    title: 'حظر أمني: استنفاد عدد الأجهزة!',
                    text: 'تم استنفاد الحد الأقصى للأجهزة المسموح بها لهذا الرابط (' + maxAllowed + ' جهاز). يرجى مراجعة رئيس المركز لزيادة عدد الأجهزة المسموحة.',
                    allowOutsideClick: false, 
                    showConfirmButton: false
                });
                return; 
            }

            const newDeviceEntry = {
                deviceId: myDeviceId,
                deviceModel: myDeviceModel,
                registeredAt: new Date().toISOString()
            };
            registeredList.push(newDeviceEntry);
            await db.collection('scanner_tokens').doc(token).update({
                registeredDevices: registeredList,
                registeredDevice: myDeviceId
            });
        }
        
        activeCenter = tokenData.center.trim();
        document.getElementById("dateInfo").innerHTML = `تاريخ: <b>${todayDate}</b> | <span style="color:#0FBA50; font-weight:bold;">المركز: ${activeCenter}</span>`;

        // 🌟 فحص النطاق الجغرافي للمركز (GPS Geofence) 🌟
        const safeCenterId = activeCenter.replace(/\//g, '-').trim();
        try {
            const centerDoc = await db.collection("center_settings").doc(safeCenterId).get();
            if (centerDoc.exists) {
                const cData = centerDoc.data();
                if (cData.latitude && cData.longitude) {
                    const centerLat = parseFloat(cData.latitude);
                    const centerLng = parseFloat(cData.longitude);
                    const allowedRadius = parseInt(cData.radiusMeters) || 100;

                    if (!isNaN(centerLat) && !isNaN(centerLng)) {
                        await checkGeofence(centerLat, centerLng, allowedRadius);
                    }
                }
            }
        } catch (geoErr) {
            console.warn("Geofence check warning:", geoErr);
        }

        // الاستماع لأوامر التقاط الصور عن بعد
        initRemotePhotoListener(token);

        // 5. تحميل كاش الأساتذة والمؤطرين لحظياً في الذاكرة لتسريع المسح
        initCenterDataCache();

        // 6. تشغيل الكاميرا والماسح
        await setupCameraAndStart();

    } catch (error) {
        console.error("Token error:", error);
        Swal.fire('خطأ في الاتصال', 'تعذر التحقق من الرابط. تأكد من اتصالك بالإنترنت.', 'error');
    }
};

// ================= كاش الذاكرة اللحظي للبيانات =================
function initCenterDataCache() {
    const centerClean = activeCenter.trim();

    // جلب المتكونين وتخزينهم في الذاكرة
    db.collection("employeescomnew").where("center", "==", centerClean).get().then(snap => {
        snap.forEach(doc => {
            const d = doc.data();
            const key = String(d.id || doc.id).trim();
            centerTraineesMap[key] = { empId: key, ...d };
        });
    }).catch(e => console.warn("Cache trainees error:", e));

    // جلب المؤطرين
    db.collection("center_framers").where("center", "==", centerClean).get().then(snap => {
        snap.forEach(doc => {
            const d = doc.data();
            const key = String(d.framerId || doc.id.split('_')[0]).trim();
            centerFramersMap[key] = { framerId: key, ...d };
        });
    }).catch(e => console.warn("Cache framers error:", e));

    // ربط مستمع لحظي على سجل حضور اليوم
    const docId = `${centerClean}_${todayDate}`;
    db.collection('attendance_daily').doc(docId).onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            todayTraineeRecords = data.records || {};
            currentSysModeTrainees = data.systemMode || "closed";
        } else {
            todayTraineeRecords = {};
            currentSysModeTrainees = "closed";
        }
        updateTotalScannedCounter();
    });

    db.collection('framers_attendance_daily').doc(docId).onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            todayFramerRecords = data.records || {};
            currentSysModeFramers = data.systemMode || "closed";
        } else {
            todayFramerRecords = {};
            currentSysModeFramers = "closed";
        }
        updateTotalScannedCounter();
    });
}

function updateTotalScannedCounter() {
    let traineeCount = 0;
    Object.values(todayTraineeRecords).forEach(r => {
        if (r && r.time) traineeCount++;
    });

    let framerCount = 0;
    Object.values(todayFramerRecords).forEach(r => {
        if (r && r.time) framerCount++;
    });

    scannedCardsCount = traineeCount + framerCount;
    const badge = document.getElementById("scanCountValue");
    if (badge) badge.innerText = scannedCardsCount;
}

// ================= تشغيل الكاميرا والماسح عالي الأداء =================
async function setupCameraAndStart() {
    try {
        html5QrCode = new Html5Qrcode("reader");

        try {
            availableCameras = await Html5Qrcode.getCameras();
        } catch(e) {
            availableCameras = [];
        }

        const btnSwitch = document.getElementById("btnSwitchCamera");
        if (availableCameras.length <= 1 && btnSwitch) {
            btnSwitch.classList.add("disabled");
        }

        const config = {
            fps: 25, // تردد التقاط سريع ومريح
            qrbox: function(viewfinderWidth, viewfinderHeight) {
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                const edge = Math.floor(minEdge * 0.75);
                return { width: Math.max(200, Math.min(edge, 320)), height: Math.max(200, Math.min(edge, 320)) };
            },
            experimentalFeatures: {
                useBarCodeDetectorIfSupported: true // تسريع عتادي مباشر في المتصفح
            },
            aspectRatio: 1.0
        };

        // اختيار الكاميرا الخلفية إن وجدت
        let cameraChoice = { facingMode: "environment" };
        if (availableCameras.length > 0) {
            // محاولة اختيار كاميرا خلفية
            let backIdx = availableCameras.findIndex(c => c.label && (c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('rear') || c.label.toLowerCase().includes('خلفية')));
            if (backIdx !== -1) {
                currentCameraIndex = backIdx;
                cameraChoice = availableCameras[backIdx].id;
            } else {
                currentCameraIndex = 0;
                cameraChoice = availableCameras[0].id;
            }
        }

        await html5QrCode.start(
            cameraChoice, 
            config, 
            onScanSuccess, 
            onScanFailure
        );

        document.getElementById("scanInstruction").innerText = "الكاميرا نشطة - وجّه الباركود داخل الإطار";

    } catch (err) {
        console.error("Camera start error:", err);
        Swal.fire({
            icon: 'error',
            title: 'تعذر تشغيل الكاميرا',
            text: 'يرجى منح المتصفح الإذن بالوصول إلى الكاميرا واستخدام اتصال آمن HTTPS.',
            confirmButtonText: 'إعادة المحاولة'
        }).then(() => location.reload());
    }
}

// ================= معالجة نتيجة المسح الذكية =================
async function onScanSuccess(decodedText) {
    if (isScanningPaused) return;

    let scannedId = String(decodedText).trim();
    if (!scannedId) return;

    // منع التكرار اللحظي لنفس البطاقة
    const now = Date.now();
    if (scannedId === lastScannedId && (now - lastScannedTime) < DEBOUNCE_DELAY) {
        return;
    }
    lastScannedId = scannedId;
    lastScannedTime = now;

    const d = new Date();
    const timeString = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    const docId = `${activeCenter}_${todayDate}`;

    // ====================================================
    // 1. فحص المتكونين (أولاً من الذاكرة اللحظية O(1))
    // ====================================================
    let trainee = centerTraineesMap[scannedId];

    if (!trainee) {
        // فحص سريع إذا كان المعرف بصيغة أرقام فقط
        const core = extractCoreId(scannedId);
        for (let k in centerTraineesMap) {
            if (extractCoreId(k) === core) {
                trainee = centerTraineesMap[k];
                break;
            }
        }
    }

    // إذا وُجد في قائمة المتكونين
    if (trainee) {
        handleTraineeScan(trainee, docId, timeString, scannedId);
        return;
    }

    // ====================================================
    // 2. فحص المؤطرين (من الذاكرة اللحظية O(1))
    // ====================================================
    let framer = centerFramersMap[scannedId];
    if (!framer) {
        const core = extractCoreId(scannedId);
        for (let k in centerFramersMap) {
            if (extractCoreId(k) === core) {
                framer = centerFramersMap[k];
                break;
            }
        }
    }

    if (framer) {
        handleFramerScan(framer, docId, timeString, scannedId);
        return;
    }

    // ====================================================
    // 3. محاولة بحث احتياطية في Firestore للمستجدين
    // ====================================================
    try {
        let tSnap = await db.collection("employeescomnew").where("id", "==", scannedId).get();
        if (!tSnap.empty) {
            let tData = { empId: tSnap.docs[0].data().id, ...tSnap.docs[0].data() };
            if (tData.center && tData.center.trim() === activeCenter) {
                centerTraineesMap[scannedId] = tData;
                handleTraineeScan(tData, docId, timeString, scannedId);
                return;
            }
        }
    } catch(e) {}

    // البطاقة غير مسجلة في هذا المركز
    playScanSound('error');
    triggerHaptic('error');

    if (isFastScanMode) {
        showQuickCard({
            name: `رقم غير مسجل: ${scannedId}`,
            sub: 'البطاقة لا تنتمي لهذا المركز إطلاقاً',
            status: 'غير مسجل',
            statusClass: 'badge-err',
            photoUrl: ''
        });
    } else {
        isScanningPaused = true;
        Swal.fire({
            icon: 'error',
            title: 'بطاقة غير مسجلة',
            text: `الرقم (${scannedId}) غير مسجل في مركزك (لا متكون ولا مؤطر)!`,
            confirmButtonText: 'متابعة المسح',
            confirmButtonColor: '#102a43'
        }).then(() => { isScanningPaused = false; });
    }
}

// معالجة مسح المتكون
function handleTraineeScan(trainee, docId, timeString, scannedId) {
    const existing = todayTraineeRecords[trainee.empId] || todayTraineeRecords[scannedId];

    // صورة المتكون
    let photoUrl = trainee.photoUrl_fb ? trainee.photoUrl_fb : employeePhotosMap[extractCoreId(scannedId)];

    // فحص إذا كان مسجلاً مسبقاً
    if (existing && existing.time && existing.time !== '') {
        playScanSound('warn');
        triggerHaptic('warn');

        if (isFastScanMode) {
            showQuickCard({
                name: trainee.name || '-',
                sub: `${trainee.grade || trainee.rank || ''} | ${trainee.maty || trainee.specialty || ''}`,
                status: `مسجل مسبقاً: ${existing.status} (${existing.time})`,
                statusClass: 'badge-warn',
                photoUrl: photoUrl
            });
        } else {
            isScanningPaused = true;
            Swal.fire({
                icon: 'info',
                title: 'مسجل مسبقاً!',
                html: `
                    <div class="swal-welcome-card" style="text-align: center;">
                        ${renderPhotoHtml(photoUrl)}
                        <span style="font-weight: bold; font-size: 16px;">${trainee.name || '-'}</span><br>
                        <span style="color:#0FBA50; font-weight:bold;">الوضعية الحالية: ${existing.status} (${existing.time})</span>
                    </div>
                `,
                confirmButtonText: 'استمرار المسح',
                timer: 4000,
                timerProgressBar: true
            }).then(() => { isScanningPaused = false; });
        }
        return;
    }

    // فحص غلق النظام
    if (currentSysModeTrainees === "closed") {
        playScanSound('error');
        triggerHaptic('error');
        if (isFastScanMode) {
            showQuickCard({
                name: trainee.name || '-',
                sub: 'تسجيل المتكونين مقفل من رئيس المركز',
                status: 'النظام مغلق',
                statusClass: 'badge-err',
                photoUrl: photoUrl
            });
        } else {
            isScanningPaused = true;
            Swal.fire({
                icon: 'error',
                title: 'النظام مغلق',
                text: 'تسجيل حضور المتكونين مغلق حالياً من قبل رئيس المركز.',
                confirmButtonText: 'حسناً',
                confirmButtonColor: '#d90429'
            }).then(() => { isScanningPaused = false; });
        }
        return;
    }

    // تسجيل الحضور بنجاح
    let status = currentSysModeTrainees === "open" ? "حاضر" : "متأخر";
    let badgeClass = status === "حاضر" ? "badge-present" : "badge-late";

    // تحديث كاش الذاكرة فوراً لسرعة الإحصاء
    todayTraineeRecords[trainee.empId] = { status: status, time: timeString };
    updateTotalScannedCounter();

    // إرسال التحديث لـ Firestore في الخلفية بدون انتظار
    db.collection('attendance_daily').doc(docId).set({
        center: activeCenter,
        date: todayDate,
        records: { [trainee.empId]: { status: status, time: timeString } }
    }, { merge: true }).catch(err => console.error("Firestore sync error:", err));

    // تحديث عدادات الرابط وتسجيل صورة أول مسح
    incrementTokenScanCounters();
    recordFirstScanAuditIfNeeded(trainee.empId);

    playScanSound('success');
    triggerHaptic('success');

    if (isFastScanMode) {
        showQuickCard({
            name: trainee.name || '-',
            sub: `${trainee.grade || trainee.rank || ''} - ${trainee.maty || trainee.specialty || ''}`,
            status: `تم التسجيل: ${status} (${timeString})`,
            statusClass: badgeClass,
            photoUrl: photoUrl
        });
    } else {
        isScanningPaused = true;
        Swal.fire({
            title: 'تم التسجيل بنجاح!',
            html: `
                <div class="swal-welcome-card">
                    <div style="text-align:center;">
                        ${renderPhotoHtml(photoUrl)}
                        <span class="swal-badge" style="background:${status === 'حاضر' ? '#0FBA50' : '#ff9800'};">
                            ${status} (${timeString})
                        </span>
                    </div>
                    <hr style="border-top: 1px dashed #ccc; margin: 10px 0;">
                    <b>المركز:</b> ${activeCenter}<br>
                    <b>الاسم واللقب:</b> ${trainee.name || '-'}<br>
                    <b>الرتبة:</b> ${trainee.grade || trainee.rank || '-'}<br>
                    <b>التخصص:</b> ${trainee.maty || trainee.specialty || '-'}
                </div>
            `,
            icon: 'success',
            confirmButtonText: 'مسح البطاقة التالية',
            timer: 5000,
            timerProgressBar: true
        }).then(() => { isScanningPaused = false; });
    }
}

// معالجة مسح المؤطر
function handleFramerScan(framer, docId, timeString, scannedId) {
    const existing = todayFramerRecords[scannedId];
    let photoUrl = employeePhotosMap[extractCoreId(scannedId)] || '';

    if (existing && existing.time && existing.time !== '') {
        playScanSound('warn');
        triggerHaptic('warn');
        if (isFastScanMode) {
            showQuickCard({
                name: framer.name || framer.framerName || 'مؤطر',
                sub: `مؤطر المركز | ${framer.role || ''}`,
                status: `مسجل مسبقاً: ${existing.status} (${existing.time})`,
                statusClass: 'badge-warn',
                photoUrl: photoUrl
            });
        } else {
            isScanningPaused = true;
            Swal.fire({
                icon: 'info', title: 'مؤطر مسجل مسبقاً!',
                text: `${framer.name || 'المؤطر'} مسجل مسبقاً في توقيت: ${existing.time}`,
                confirmButtonText: 'متابعة المسح'
            }).then(() => { isScanningPaused = false; });
        }
        return;
    }

    if (currentSysModeFramers === "closed") {
        playScanSound('error');
        triggerHaptic('error');
        return;
    }

    let status = "حاضر";
    todayFramerRecords[scannedId] = { status: status, time: timeString };
    updateTotalScannedCounter();

    db.collection('framers_attendance_daily').doc(docId).set({
        center: activeCenter,
        date: todayDate,
        records: { [scannedId]: { status: status, time: timeString } }
    }, { merge: true }).catch(e => console.error(e));

    // تحديث عدادات الرابط وتسجيل صورة أول مسح
    incrementTokenScanCounters();
    recordFirstScanAuditIfNeeded(scannedId);

    playScanSound('success');
    triggerHaptic('success');

    if (isFastScanMode) {
        showQuickCard({
            name: framer.name || framer.framerName || 'مؤطر المركز',
            sub: `مؤطر: ${framer.role || 'تأطير بيداغوجي'}`,
            status: `تم تسجيل المؤطر: حاضر (${timeString})`,
            statusClass: 'badge-present',
            photoUrl: photoUrl
        });
    } else {
        isScanningPaused = true;
        Swal.fire({
            icon: 'success',
            title: 'تم تسجيل المؤطر بنجاح',
            text: `${framer.name || 'المؤطر'} - حاضر (${timeString})`,
            confirmButtonText: 'مسح البطاقة التالية',
            timer: 4000
        }).then(() => { isScanningPaused = false; });
    }
}

// عرض كرت المسح السريع الفوري
function showQuickCard(item) {
    const card = document.getElementById("quickScanCard");
    const imgEl = document.getElementById("quickCardImg");
    const nameEl = document.getElementById("quickCardName");
    const subEl = document.getElementById("quickCardSub");
    const statusEl = document.getElementById("quickCardStatus");

    if (!card) return;

    if (item.photoUrl) {
        imgEl.src = item.photoUrl;
        imgEl.style.display = "block";
    } else {
        imgEl.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
        imgEl.style.display = "block";
    }

    nameEl.innerText = item.name;
    subEl.innerText = item.sub;
    statusEl.innerText = item.status;
    statusEl.className = `quick-card-status ${item.statusClass || 'badge-present'}`;

    card.classList.add("visible");

    if (quickCardTimer) clearTimeout(quickCardTimer);
    quickCardTimer = setTimeout(() => {
        dismissQuickCard();
    }, 2800);
}

function dismissQuickCard() {
    const card = document.getElementById("quickScanCard");
    if (card) card.classList.remove("visible");
}

function renderPhotoHtml(photoUrl) {
    return photoUrl
        ? `<img src="${photoUrl}" style="width: 85px; height: 85px; border-radius: 50%; object-fit: cover; border: 3px solid #0FBA50; margin: 0 auto 10px auto; display: block; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">`
        : `<div style="width: 85px; height: 85px; border-radius: 50%; background: #f1f5f9; display: flex; justify-content: center; align-items: center; border: 3px solid #ccc; margin: 0 auto 10px auto;"><i class="fa-solid fa-user" style="font-size: 40px; color: #cbd5e1;"></i></div>`;
}

function onScanFailure(error) {
    // تجاهل الأخطاء العادية أثناء عدم العثور على باركود في الإطار
}

// ================= أزرار التحكم في الشريط العلوي =================
function toggleFastMode() {
    isFastScanMode = !isFastScanMode;
    const btn = document.getElementById("btnToggleFastMode");
    if (btn) {
        if (isFastScanMode) {
            btn.classList.add("active");
            btn.title = "وضع المسح السريع المتتابع (مفعل)";
        } else {
            btn.classList.remove("active");
            btn.title = "الوضع التفصيلي بالنافذة";
        }
    }
}

async function toggleTorch() {
    if (!html5QrCode) return;
    const btn = document.getElementById("btnToggleTorch");

    try {
        isTorchOn = !isTorchOn;
        await html5QrCode.applyVideoConstraints({
            advanced: [{ torch: isTorchOn }]
        });
        if (btn) {
            if (isTorchOn) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        }
    } catch (e) {
        console.warn("Torch not supported:", e);
        isTorchOn = false;
        if (btn) {
            btn.classList.remove("active");
            btn.classList.add("disabled");
            btn.title = "الكشاف غير مدعوم على هذا الجهاز";
        }
    }
}

async function switchCamera() {
    if (!html5QrCode || availableCameras.length <= 1) return;

    try {
        currentCameraIndex = (currentCameraIndex + 1) % availableCameras.length;
        const selectedCam = availableCameras[currentCameraIndex];

        await html5QrCode.stop();
        
        const config = {
            fps: 25,
            qrbox: function(viewfinderWidth, viewfinderHeight) {
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                const edge = Math.floor(minEdge * 0.75);
                return { width: Math.max(200, Math.min(edge, 320)), height: Math.max(200, Math.min(edge, 320)) };
            },
            experimentalFeatures: { useBarCodeDetectorIfSupported: true },
            aspectRatio: 1.0
        };

        await html5QrCode.start(selectedCam.id, config, onScanSuccess, onScanFailure);

    } catch (e) {
        console.error("Switch camera error:", e);
    }
}

function toggleSound() {
    isSoundEnabled = !isSoundEnabled;
    const btn = document.getElementById("btnToggleSound");
    if (btn) {
        if (isSoundEnabled) {
            btn.classList.add("active");
            btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        } else {
            btn.classList.remove("active");
            btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
        }
    }
}
