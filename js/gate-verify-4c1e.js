(function() {
      const token = sessionStorage.getItem("admin_entry_token");
      const time = parseInt(sessionStorage.getItem("admin_entry_time") || "0", 10);
      const now = Date.now();

      // التصريح صالح لمدة 30 ثانية فقط من لحظة النقر في index.html، أو إذا كانت جلسة نشطة
      const isValidToken = token && (now - time < 30000);
      const hasActiveSession = sessionStorage.getItem("admin_page_active") === "true";

      // إذا لم يأتِ من index أو فتح الرابط مباشرة أو من المفضلة
      if (!isValidToken && !hasActiveSession) {
        sessionStorage.removeItem("admin_entry_token");
        sessionStorage.removeItem("admin_entry_time");
        sessionStorage.removeItem("admin_page_active");
        // طرد فوري إلى الصفحة الرئيسية
        window.location.replace("/login");
      } else {
        // استهلاك توكن الانتقال وتفعيل الجلسة الحالية
        sessionStorage.removeItem("admin_entry_token");
        sessionStorage.removeItem("admin_entry_time");
        sessionStorage.setItem("admin_page_active", "true");

        // إظهار الصفحة بعد نجاح التحقق
        document.addEventListener("DOMContentLoaded", function() {
          const gateStyle = document.getElementById("pageGateStyle");
          if (gateStyle) gateStyle.remove();
        });
      }
    })();

// ==========================================
// كود التحقق والدخول
// ==========================================
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

function togglePasswordVisibility() {
    const inputField = document.getElementById("accessCode");
    const icon = document.getElementById("toggleIcon");
    if (inputField.type === "password") {
        inputField.type = "text"; 
        icon.classList.remove("fa-eye"); 
        icon.classList.add("fa-eye-slash");
    } else {
        inputField.type = "password"; 
        icon.classList.remove("fa-eye-slash"); 
        icon.classList.add("fa-eye");
    }
}

async function checkAccessCode() {
  const inputVal = document.getElementById("accessCode").value.trim();

  if (!inputVal) {
    Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى إدخال كود الدخول', confirmButtonText: 'حسناً', confirmButtonColor: '#1E68E8' });
    return;
  }

  Swal.fire({ title: 'جاري التحقق والمصادقة...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  try {
      const configRef = db.collection("config").doc("pass");
      const configSnap = await configRef.get();
      
      if (configSnap.exists) {
          const configData = configSnap.data();
          const adminPassword = configData['admin_panel_of']; 
          
          if (inputVal === adminPassword) {
              const adminEmail = "admin_directorate@system.local";
              
              try {
                  await firebase.auth().signInWithEmailAndPassword(adminEmail, inputVal);
              } catch(e) {
                  if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-login-credentials' || e.code === 'auth/invalid-credential') {
                      await firebase.auth().createUserWithEmailAndPassword(adminEmail, inputVal);
                  } else {
                      throw e;
                  }
              }

              // إزالة تصريح الدخول المؤقت عند الانتقال للوحة التحكم
              sessionStorage.removeItem("admin_page_active");

              if (window.SecurityGuard) { SecurityGuard.createSession("ADMIN_ACCESS", "ADMIN", "مدير النظام"); } else { sessionStorage.setItem("userEmpId", "ADMIN_ACCESS"); } 
              sessionStorage.setItem("userName", "مدير النظام"); 
              sessionStorage.setItem("isLoggedIn", "true");
              
              Swal.fire({ icon: 'success', title: 'مرحباً بك', text: 'جاري التوجيه إلى لوحة تحكم المديرية...', timer: 1500, showConfirmButton: false })
              .then(() => window.location.href = "/admin-panel");
              
              return; 
          }
      }

      const querySnapshot = await db.collection("center_admins").where("password", "==", inputVal).get();
      
      if (!querySnapshot.empty) {
          const adminData = querySnapshot.docs[0].data();
          
          if (adminData.disabled === true) {
              Swal.fire({ icon: 'error', title: 'حساب معطل', text: 'عذراً، تم تعطيل هذا الحساب من قبل الإدارة المركزية.', confirmButtonText: 'حسناً', confirmButtonColor: '#d32f2f' });
              return;
          }

          const inspectorEmail = adminData.email || `inspector_${adminData.id}@system.local`; 
          
          try {
              await firebase.auth().signInWithEmailAndPassword(inspectorEmail, inputVal);
          } catch(e) {
               if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-login-credentials' || e.code === 'auth/invalid-credential') {
                  await firebase.auth().createUserWithEmailAndPassword(inspectorEmail, inputVal);
              } else {
                  throw e;
              }
          }

          // إزالة تصريح الدخول المؤقت عند الانتقال للوحة التحكم
          sessionStorage.removeItem("admin_page_active");

          if (window.SecurityGuard) { SecurityGuard.createSession(adminData.id, "INSPECTOR", adminData.name, { inspectorCenter: adminData.center }); } else { sessionStorage.setItem("userEmpId", adminData.id); } 
          sessionStorage.setItem("userName", adminData.name); 
          sessionStorage.setItem("inspectorCenter", adminData.center); 
          sessionStorage.setItem("isLoggedIn", "true");

          Swal.fire({
            icon: 'success',
            title: `مرحباً بك ${adminData.name}`,
            text: `جاري توجيهك إلى مركزك: ${adminData.center}`,
            timer: 2000,
            showConfirmButton: false
          }).then(() => {
            window.location.href = "/inspector";
          });

      } else {
          Swal.fire({ icon: "error", title: "كود خاطئ", text: "يرجى التأكد من الرقم السري والمحاولة مرة أخرى", confirmButtonText: "حسناً", confirmButtonColor: '#d32f2f' });
      }
  } catch (error) {
      console.error("Auth Error:", error);
      Swal.fire({ icon: 'error', title: 'خطأ في الاتصال', text: 'تأكد من صحة الكود السري أو جودة الإنترنت.', confirmButtonColor: '#1E68E8' });
  }
}

const registrationOpen = true; 
window.onload = function() {
    if (!registrationOpen) {
        document.querySelector(".input-wrapper").style.display = "none";
        const buttons = document.querySelectorAll("button");
        buttons.forEach(btn => btn.style.display = "none");
        const msg = document.createElement("div");
        msg.innerHTML = `<div style="background: #e2e8f0; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 12px; padding: 15px; margin-bottom: 20px; font-size: 16px; font-weight: 700;">الموقع مغلق حاليًا<br></div>`;
        document.querySelector(".header-text").appendChild(msg);
    }
};