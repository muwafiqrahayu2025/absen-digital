import {setGlobalOptions} from "firebase-functions";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.database();

setGlobalOptions({maxInstances: 10});

// ── API Proxy Functions (Fase 3 Security — API Key tidak pernah ke client) ──
export {sendWhatsAppProxy, sendGeminiProxy} from "./proxy.js";

export const permanentlyDeleteTenant = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError(
      "unauthenticated",
      "Harus login untuk melakukan aksi ini."
    );
  }

  const {tenantId} = request.data;
  if (!tenantId) {
    throw new HttpsError(
      "invalid-argument",
      "tenantId tidak boleh kosong."
    );
  }

  const uid = auth.uid;
  const globalAdminsRef = db.ref(`global_admins/${uid}`);
  const snap = await globalAdminsRef.get();
  const isGlobalAdmin = snap.exists() && snap.val() === true;

  if (!isGlobalAdmin && auth.token.role !== "developer") {
    if (!isGlobalAdmin) {
      throw new HttpsError(
        "permission-denied",
        "Hanya developer atau super admin yang dapat mengakses."
      );
    }
  }

  try {
    const tenantUsersRef = db.ref(`tenants/${tenantId}/users`);
    const tenantUsersSnap = await tenantUsersRef.get();

    if (tenantUsersSnap.exists()) {
      const usersData = tenantUsersSnap.val();
      const uids = Object.keys(usersData);

      if (uids.length > 0) {
        for (let i = 0; i < uids.length; i += 1000) {
          const chunk = uids.slice(i, i + 1000);
          await admin.auth().deleteUsers(chunk);
        }
      }

      const mappingUpdates: Record<string, null> = {};
      uids.forEach((u) => {
        mappingUpdates[u] = null;
      });
      if (Object.keys(mappingUpdates).length > 0) {
        await db.ref("user_tenant_mapping").update(mappingUpdates);
      }
    }

    await db.ref(`tenants/${tenantId}`).remove();

    return {
      success: true,
      message: `Tenant ${tenantId} berhasil dihapus permanen.`,
    };
  } catch (error) {
    console.error("Error permanently deleting tenant:", error);
    throw new HttpsError(
      "internal",
      "Gagal menghapus tenant secara permanen."
    );
  }
});
