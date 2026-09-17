// ================= إعدادات Firebase =================
const firebaseConfig = {
  apiKey: "AIzaSyBNBrVpBK8p_WWNwNhSH-mZ6NXOyr2TLhI",
  authDomain: "voyage-touggourt-48755.firebaseapp.com",
  projectId: "voyage-touggourt-48755",
  storageBucket: "voyage-touggourt-48755.firebasestorage.app",
  messagingSenderId: "712694455348",
  appId: "1:712694455348:web:5b4e8df57347edf944fe61",
  measurementId: "G-TTJT4LQ65L"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const DASHBOARD_PAGE = "/portal"; 

const REGEX_PATTERNS = {
  nonDigit: /\D/g
};

function validateNumber(input) {
  // السماح بإدخال كود مدير التربية أو الرموز الخاصة بالإدارة دون حذفها
  const v = input.value.trim();
  if (v.startsWith("M") || v.startsWith("m") || v.includes("@") || v.includes("#")) {
    if (input.value.length > 20) input.value = input.value.slice(0, 20);
    return;
  }
  input.value = input.value.replace(REGEX_PATTERNS.nonDigit, '');
  if (input.value.length > 16) input.value = input.value.slice(0, 16);
}

// دالة مصادقة جلسة السيد مدير التربية والتوجيه للوحة القيادة
function authenticateDirectorSession() {
  Swal.fire({
    title: 'فضاء السيد مدير التربية',
    html: `
      <div style="text-align:center; padding:12px;">
        <div style="font-size:46px; color:#f59e0b; margin-bottom:12px; filter: drop-shadow(0 4px 10px rgba(245,158,11,0.3));">
          <i class="fa-solid fa-crown"></i>
        </div>
        <h3 style="color:#085d28; margin:0 0 10px 0; font-weight:900; font-size:20px;">مرحباً بكم سيدي مدير التربية المحترم</h3>
        <p style="color:#334155; font-size:14px; margin:0; line-height:1.6;">
          مديرية التربية لولاية توقرت<br>
          <span style="color:#0284c7; font-weight:700;">جاري فتح الديوان ولوحة القيادة الاستراتيجية الشاملة...</span>
        </p>
      </div>
    `,
    timer: 2000,
    timerProgressBar: true,
    showConfirmButton: false,
    allowOutsideClick: false,
    willClose: () => {
      if (window.SecurityGuard) {
        SecurityGuard.createSession("DIRECTOR_ACCESS", "DIRECTOR", "السيد مدير التربية", { isDirector: "true" });
      } else {
        sessionStorage.setItem("userEmpId", "DIRECTOR_ACCESS");
        sessionStorage.setItem("userName", "السيد مدير التربية");
        sessionStorage.setItem("userRole", "DIRECTOR");
        sessionStorage.setItem("isLoggedIn", "true");
      }
      window.location.href = (window.location.protocol === "file:") ? "director_dashboard.html" : "/director";
    }
  });
}

// نافذة الدخول المباشر للسيد مدير التربية
window.openDirectorLoginModal = async function() {
  const { value: code } = await Swal.fire({
    title: '👑 فضاء السيد مدير التربية',
    html: `
      <div style="text-align:center; margin-bottom:15px;">
        <p style="color:#475569; font-size:13.5px; margin:0; font-weight:600;">الجمهورية الجزائرية الديمقراطية الشعبية - وزارة التربية الوطنية</p>
        <p style="color:#085d28; font-size:14px; margin:4px 0 0 0; font-weight:800;">مديرية التربية لولاية توقرت - الولوج السيادي للديوان</p>
      </div>
    `,
    input: 'password',
    inputPlaceholder: 'أدخل الكود السري الخاص بالسيد مدير التربية...',
    showCancelButton: true,
    confirmButtonText: '<i class="fa-solid fa-right-to-bracket"></i> دخول للديوان',
    cancelButtonText: 'إلغاء',
    confirmButtonColor: '#085d28',
    cancelButtonColor: '#64748b',
    inputAttributes: {
      autocapitalize: 'off',
      autocorrect: 'off'
    }
  });

  if (code) {
    Swal.fire({ title: 'جاري المصادقة والتحقق السيادي...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      let isMatch = (code.trim() === "MO@TR#55");
      if (!isMatch) {
        const passDoc = await db.collection("config").doc("pass").get();
        if (passDoc.exists) {
          const d = passDoc.data();
          if (d.director === code.trim() || d.director_code === code.trim()) {
            isMatch = true;
          }
        }
      }

      if (isMatch) {
        authenticateDirectorSession();
      } else {
        Swal.fire({
          icon: 'error',
          title: '❌ كود غير صحيح',
          text: 'الرمز السري المدخل غير مطابق لكود فضاء السيد مدير التربية.',
          confirmButtonText: 'حسناً',
          confirmButtonColor: '#085d28'
        });
      }
    } catch(err) {
      console.error(err);
      if (code.trim() === "MO@TR#55") {
        authenticateDirectorSession();
      } else {
        Swal.fire('خطأ', 'حدث خطأ أثناء فحص الصلاحية في قاعدة البيانات', 'error');
      }
    }
  }
};

async function checkEmployee() {
  const empId = document.getElementById("empId").value.trim();

  // فحص ما إذا كان المدخل كود مدير التربية
  if (empId === "MO@TR#55") {
    authenticateDirectorSession();
    return;
  }

  // فحص الكود من قاعدة البيانات إذا كان يشتمل على حروف أو رموز
  if (empId.length >= 5 && (empId.includes("@") || empId.includes("#") || empId.startsWith("M") || empId.startsWith("m"))) {
    try {
      const passDoc = await db.collection("config").doc("pass").get();
      if (passDoc.exists) {
        const d = passDoc.data();
        if (d.director === empId || d.director_code === empId) {
          authenticateDirectorSession();
          return;
        }
      }
    } catch (e) {
      console.warn("Check director pass:", e);
    }
  }

  if (!empId || empId.length < 5) {
    Swal.fire({ 
      icon: 'warning', 
      title: 'تنبيه', 
      text: 'يرجى إدخال رقم التعريف الوظيفي بشكل صحيح',
      confirmButtonText: 'حسناً'
    });
    return;
  }

  Swal.fire({ title: 'جاري التحقق...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  try {
    // 1. الفحص الفوري في قاعدة بيانات حسابات الأساتذة المؤطرين
    const supQuery = await db.collection("supervisor_accounts").where("empId", "==", empId).get();
    if (!supQuery.empty) {
      let activeDocs = [];
      let disabledDocs = [];
      supQuery.forEach(doc => {
        let d = doc.data();
        if (d.status === "disabled") disabledDocs.push(d);
        else activeDocs.push(d);
      });

      if (activeDocs.length === 0 && disabledDocs.length > 0) {
        Swal.close();
        Swal.fire({
          icon: "warning",
          title: "الحساب معطل",
          text: "عذراً أستاذنا الفاضل، لقد تم تعطيل حسابكم من طرف إدارة المركز. يرجى مراجعة إدارة المركز.",
          confirmButtonText: "حسناً"
        });
        return;
      }

      // اعتماد الجلسة للأستاذ المؤطر
      const firstActive = activeDocs[0];
      const supervisorName = firstActive.name || "الأستاذ المؤطر";

      if (window.SecurityGuard) {
        SecurityGuard.createSession(empId, "SUPERVISOR", supervisorName, { isSupervisor: "true" });
      } else {
        sessionStorage.setItem("userEmpId", empId);
        sessionStorage.setItem("userName", supervisorName);
        sessionStorage.setItem("userRole", "SUPERVISOR");
        sessionStorage.setItem("isLoggedIn", "true");
      }

      Swal.close();
      Swal.fire({
        icon: 'success',
        title: 'مرحباً بك أستاذنا الفاضل',
        html: `<b>${supervisorName}</b><br>جاري الدخول إلى فضاء الأساتذة المؤطرين...`,
        timer: 1500,
        timerProgressBar: true,
        showConfirmButton: false,
        willClose: () => {
          window.location.href = (window.location.protocol === "file:") ? "supervisor_portal.html" : "/supervisor-portal";
        }
      });
      return;
    }

    // 2. إذا لم يكن أستاذاً مؤطراً، يتم التحقق كأستاذ متربص (المتكونين)
    if (empId.length < 16) {
      Swal.close();
      Swal.fire({ 
        icon: 'warning', 
        title: 'تنبيه', 
        text: 'رقم التعريف الوظيفي للأستاذ المتربص يجب أن يتكون من 16 رقمًا',
        confirmButtonText: 'حسناً'
      });
      return;
    }

    const docRef = db.collection("employeescomnew").doc(empId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      Swal.close();
      Swal.fire({
        icon: "error",
        title: "❌ خطأ",
        html: `
         رقم الموظف غير موجود ضمن قاعدة بيانات الأساتذة المتربصين<br>
يرجى مراجعة الرقم المدخل أو التواصل مع مصالح المديرية.<br><br>
        `,
        confirmButtonText: "حسناً"
      });
      return;
    }

    const data = docSnap.data();
    
    if (window.SecurityGuard) { SecurityGuard.createSession(empId, "USER", data.name || "الموظف"); } else { sessionStorage.setItem("userEmpId", empId); }
    sessionStorage.setItem("userName", data.name || "الموظف");
    sessionStorage.setItem("isLoggedIn", "true");

    Swal.close();
    
    Swal.fire({
      icon: 'success',
      title: 'تم التحقق بنجاح',
      html: `مرحباً بك <b>${data.name || ''}</b><br>جاري تسجيل الدخول ...`,
      timer: 1500,
      timerProgressBar: true,
      showConfirmButton: false,
      willClose: () => {
        window.location.href = DASHBOARD_PAGE;
      }
    });

  } catch (err) {
    Swal.close();
    Swal.fire({
      icon: "error",
      title: "❌ خطأ",
      text: "حدث خطأ أثناء الاتصال بقاعدة البيانات",
      confirmButtonText: "حسناً"
    });
    console.error("Firebase error:", err);
  }
}

// ================= كود ماسح الباركود (كاميرا + صورة) =================
let scanner = null;

function startBarcodeScanner() {
    const readerDiv = document.getElementById("reader");
    const imageInput = document.getElementById("barcodeImage");

    imageInput.style.display = "block";
    readerDiv.innerHTML = "";
    readerDiv.style.display = "block";

    if (scanner) return;

    scanner = new Html5Qrcode("reader");

    scanner.start(
        { facingMode: { exact: "environment" } },
        { fps: 12, qrbox: 250 },
        decodedText => {
            if (navigator.vibrate) navigator.vibrate(200);

            document.getElementById("empId").value = decodedText;

            scanner.stop().then(() => {
                scanner = null;
                readerDiv.style.display = "none";
                imageInput.style.display = "none";
            });

            checkEmployee();
        }
    ).catch(() => {
        Html5Qrcode.getCameras().then(cameras => {
            if (!cameras.length) {
                Swal.fire("خطأ", "لا توجد كاميرات متاحة", "error");
                return;
            }

            const backCam = cameras.find(c =>
                c.label.toLowerCase().includes("back") ||
                c.label.toLowerCase().includes("rear")
            );

            const camToUse = backCam ? backCam.id : cameras[0].id;

            scanner.start(
                camToUse,
                { fps: 12, qrbox: 250 },
                decodedText => {
                    if (navigator.vibrate) navigator.vibrate(200);

                    document.getElementById("empId").value = decodedText;

                    scanner.stop().then(() => {
                        scanner = null;
                        readerDiv.style.display = "none";
                        imageInput.style.display = "none";
                    });

                    checkEmployee();
                }
            );
        });
    });

    imageInput.onchange = function (e) {
        let file = e.target.files[0];
        if (!file) return;

        document.getElementById("imageLoaderOverlay").style.display = "flex";
        readerDiv.innerHTML = "";

        let hiddenDiv = document.createElement("div");
        hiddenDiv.id = "temp-file-scan";
        hiddenDiv.style.display = "none";
        document.body.appendChild(hiddenDiv);

        const fileScanner = new Html5Qrcode("temp-file-scan");

        fileScanner.scanFile(file, true)
            .then(decodedText => {
                document.getElementById("imageLoaderOverlay").style.display = "none";

                if (navigator.vibrate) navigator.vibrate(200);
                document.getElementById("empId").value = decodedText;
                
                try { 
                    if (hiddenDiv.parentNode) hiddenDiv.parentNode.removeChild(hiddenDiv); 
                } catch(err) { console.log(err); }
                
                if (scanner) { 
                    scanner.stop().then(() => {
                        scanner = null;
                        readerDiv.style.display = "none";
                        imageInput.style.display = "none";
                        imageInput.value = ""; 
                    }).catch(()=>{}); 
                } else {
                    readerDiv.style.display = "none";
                    imageInput.style.display = "none";
                    imageInput.value = "";
                }

                setTimeout(() => {
                    checkEmployee();
                }, 100);

            })
            .catch((err) => {
                document.getElementById("imageLoaderOverlay").style.display = "none";
                try { 
                    if (hiddenDiv.parentNode) hiddenDiv.parentNode.removeChild(hiddenDiv); 
                } catch(err) { console.log(err); }
                
                console.error("Scan Error:", err);
                
                Swal.fire({
                    icon: "warning",
                    title: "تنبيه",
                    text: "لم يتم العثور على باركود واضح في الصورة",
                    confirmButtonText: "حسناً",
                    confirmButtonColor: "#0FBA50"
                }).then(() => {
                    imageInput.value = "";
                });
            });
    };
}

const registrationOpen = true; 

window.onload = function() {
    if (!registrationOpen) {
        document.getElementById("empId").style.display = "none";
        const buttons = document.querySelectorAll("button");
        buttons.forEach(btn => btn.style.display = "none");

        const msg = document.createElement("div");
        msg.innerHTML = `
        <div style="background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 10px; padding: 15px; margin-bottom: 20px; font-size: 18px; font-weight: 600;">
            الموقع مغلق حاليًا<br>
        </div>`;
        document.querySelector(".header-text").appendChild(msg);
    }
};  

// ================= كود الدخول المخفي (10 نقرات على الشعار) =================
let logoClickCount = 0;
let clickTimer;

function handleLogoClick() {
    logoClickCount++;
    
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
        logoClickCount = 0;
    }, 2000);

    if (logoClickCount === 10) {
        logoClickCount = 0; 
        promptSecretAdminPassword();
    }
}

async function promptSecretAdminPassword() {
    const { value: password } = await Swal.fire({
        title: '🔒 ولوج خاص',
        text: 'الرجاء إدخال الرقم السري للوحة التحكم',
        input: 'password',
        inputPlaceholder: 'أدخل الرقم السري هنا...',
        showCancelButton: true,
        confirmButtonText: 'دخول',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#0FBA50',
        cancelButtonColor: '#d33',
        inputAttributes: {
            autocapitalize: 'off',
            autocorrect: 'off'
        }
    });

    if (password) {
        Swal.fire({
            title: 'جاري التحقق...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const docRef = db.collection("config").doc("pass");
            const docSnap = await docRef.get();

            if (docSnap.exists) {
                const data = docSnap.data();
                const correctPassword = data['admin panel'];

                if (password === "MO@TR#55" || password === data.director || password === data.director_code) {
                    authenticateDirectorSession();
                    return;
                }

                if (password === correctPassword) {
                    // 🌟 إنشاء تصريح مرور مؤقت صالح لـ 30 ثانية فقط 🌟
                    const entryToken = "GATE_" + Math.random().toString(36).substring(2) + "_" + Date.now();
                    sessionStorage.setItem("admin_entry_token", entryToken);
                    sessionStorage.setItem("admin_entry_time", Date.now().toString());

                    Swal.fire({
                        icon: 'success',
                        title: 'تم التحقق بنجاح',
                        text: 'جاري تحويلك إلى لوحة التحكم...',
                        timer: 1500,
                        showConfirmButton: false,
                        willClose: () => {
                            window.location.href = "/secure-login";
                        }
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: '❌ خطأ',
                        text: 'الرقم السري غير صحيح',
                        confirmButtonText: 'حسناً',
                        confirmButtonColor: '#0FBA50'
                    });
                }
            } else {
                Swal.fire('خطأ', 'لم يتم العثور على إعدادات الحماية في قاعدة البيانات', 'error');
            }
        } catch (error) {
            console.error("Error verifying admin password:", error);
            Swal.fire('خطأ', 'حدث خطأ أثناء الاتصال بقاعدة البيانات', 'error');
        }
    }
}