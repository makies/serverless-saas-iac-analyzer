import { createAndSignUpUser } from "@aws-amplify/seed";

/**
 * Amplify Sandbox Seed Script
 * テスト用ユーザーを作成します
 */
export default async function seed() {
  console.log("🌱 Starting Amplify Sandbox Seed...");

  try {
    // テストユーザーの作成のみ実行
    await createTestUsers();
    
    console.log("✅ Seed completed successfully!");
    console.log("ℹ️ テストデータはフロントエンドUIから作成してください");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    // エラーが発生してもスキップ
  }
}

/**
 * テストユーザーを作成
 */
async function createTestUsers() {
  console.log("👥 Creating test users...");

  try {
    // システム管理者ユーザー
    const systemAdmin = await createAndSignUpUser({
      username: "system-admin@demo.com",
      password: "TempPass123!",
      signInAfterCreation: false,
      signInFlow: "Password",
      userAttributes: {
        email: "system-admin@demo.com",
        givenName: "システム",
        familyName: "管理者"
      }
    });

    console.log("✅ System admin user created");

    // テナント管理者ユーザー
    const clientAdmin = await createAndSignUpUser({
      username: "client-admin@demo-tenant.com",
      password: "TempPass123!",
      signInAfterCreation: false,
      signInFlow: "Password",
      userAttributes: {
        email: "client-admin@demo-tenant.com",
        givenName: "デモ",
        familyName: "管理者"
      }
    });

    console.log("✅ Client admin user created");
    console.log("✅ Test users created successfully");
    
    return { systemAdmin, clientAdmin };
  } catch (error) {
    console.log("ℹ️ Users may already exist or there was an error, continuing...");
    console.error("User creation error:", error);
    return {};
  }
}