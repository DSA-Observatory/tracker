/// <reference path="../pb_data/types.d.ts" />

/**
 * Initial PocketBase setup migration
 *
 * This migration:
 * 1. Creates the superadmin user (only on first run when pb_data is empty)
 * 2. Sets up the posts collection with all fields
 * 3. Configures application settings
 */
migrate((app) => {
  console.log("Running initial setup migration...");

  // ============================================================
  // 1. Create Superadmin User (First Time Only)
  // ============================================================
  try {
    const adminEmail = $os.getenv("POCKETBASE_ADMIN_EMAIL") || "admin@admin.local";
    const adminPassword = $os.getenv("POCKETBASE_ADMIN_PASSWORD") || "1234567890";

    console.log(`Checking for superadmin: ${adminEmail}`);

    // Check if any superusers exist (first run check)
    let existingSuperuser = null;
    try {
      existingSuperuser = app.findFirstRecordByFilter("_superusers", "id != ''");
    } catch (e) {
      // No superusers found, this is expected on first run
    }

    if (!existingSuperuser) {
      console.log("First run detected. Creating superadmin user...");
      const superusers = app.findCollectionByNameOrId("_superusers");
      const record = new Record(superusers);
      record.set("email", adminEmail);
      record.set("password", adminPassword);
      app.save(record);
      console.log(`✓ Superadmin created: ${adminEmail}`);
    } else {
      console.log("Superadmin already exists. Skipping creation.");
    }
  } catch (e) {
    console.error("Failed to create superadmin:", e);
    throw e; // Stop migration on superadmin creation failure
  }

  // ============================================================
  // 2. Get or Create Users Auth Collection
  // ============================================================
  let usersCollection = null;
  try {
    console.log("Checking for users collection...");

    // Try to find existing users collection
    try {
      usersCollection = app.findCollectionByNameOrId("users");
      console.log("✓ Found existing users collection with ID:", usersCollection.id);
    } catch (e) {
      // Users collection doesn't exist, create it
      console.log("Users collection not found, creating new one...");

      usersCollection = new Collection({
        name: "users",
        type: "auth",
        system: false,

        // API Rules - Users can only read their own profile
        listRule: "id = @request.auth.id",
        viewRule: "id = @request.auth.id",
        createRule: "",
        updateRule: "id = @request.auth.id",
        deleteRule: "id = @request.auth.id",

        // Auth options
        options: {
          allowEmailAuth: true,
          allowOAuth2Auth: false,
          allowUsernameAuth: false,
          exceptEmailDomains: [],
          manageRule: null,
          minPasswordLength: 8,
          onlyEmailDomains: [],
          onlyVerified: false,
          requireEmail: true,
        },

        // Fields
        fields: [
          {
            name: "id",
            type: "text",
            required: true,
            primaryKey: true,
            autogeneratePattern: "[a-z0-9]{15}",
            min: 15,
            max: 15,
            pattern: "^[a-z0-9]+$",
            hidden: false,
            presentable: false,
            system: true,
          },
          {
            name: "name",
            type: "text",
            required: false,
            max: 0,
            min: 0,
            pattern: "",
            hidden: false,
            presentable: false,
            system: false,
          },
          {
            name: "avatar",
            type: "file",
            required: false,
            options: {
              maxSelect: 1,
              maxSize: 5242880,
              mimeTypes: ["image/jpeg", "image/png", "image/svg+xml", "image/gif", "image/webp"],
              thumbs: ["100x100"],
              protected: false,
            },
            hidden: false,
            presentable: false,
            system: false,
          },
        ],

        indexes: [],
      });

      app.save(usersCollection);
      console.log("✓ Users collection created with ID:", usersCollection.id);
    }
  } catch (e) {
    console.error("Failed to handle users collection:", e);
    throw e;
  }

  // ============================================================
  // 3. Create Posts Collection
  // ============================================================
  try {
    console.log("Creating posts collection...");

    const postsCollection = new Collection({
      name: "posts",
      type: "base",
      system: false,

      // API Rules - Public read, no write
      listRule: "",
      viewRule: "",
      createRule: null,
      updateRule: null,
      deleteRule: null,

      // Fields
      fields: [
        {
          name: "id",
          type: "text",
          required: true,
          primaryKey: true,
          autogeneratePattern: "[a-z0-9]{15}",
          min: 15,
          max: 15,
          pattern: "^[a-z0-9]+$",
          hidden: false,
          presentable: false,
          system: true,
        },
        {
          name: "title",
          type: "text",
          required: true,
          max: 0,
          min: 0,
          pattern: "",
          hidden: false,
          presentable: false,
          system: false,
        },
        {
          name: "content",
          type: "editor",
          required: false,
          maxSize: 0,
          convertURLs: false,
          hidden: false,
          presentable: false,
          system: false,
        },
        {
          name: "published",
          type: "bool",
          required: false,
          hidden: false,
          presentable: false,
          system: false,
        },
        {
          name: "description",
          type: "text",
          required: false,
          max: 0,
          min: 0,
          pattern: "",
          hidden: false,
          presentable: false,
          system: false,
        },
        {
          name: "created",
          type: "autodate",
          onCreate: true,
          onUpdate: false,
          hidden: false,
          presentable: false,
          system: false,
        },
        {
          name: "updated",
          type: "autodate",
          onCreate: true,
          onUpdate: true,
          hidden: false,
          presentable: false,
          system: false,
        },
      ],

      indexes: [],
    });

    app.save(postsCollection);
    console.log("✓ Posts collection created");
  } catch (e) {
    console.error("Failed to create posts collection:", e);
    throw e;
  }

  // ============================================================
  // 4. Create Todos Collection
  // ============================================================
  try {
    console.log("Creating todos collection...");

    // Get the users collection first
    const usersColl = app.findCollectionByNameOrId("users");
    const usersCollId = usersColl.id;
    console.log("Users collection ID for relation:", usersCollId);

    // Create todos collection with all fields including relation
    const todosCollection = new Collection({
      name: "todos",
      type: "base",
      system: false,

      listRule: "user = @request.auth.id",
      viewRule: "user = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "user = @request.auth.id",
      deleteRule: "user = @request.auth.id",

      fields: [
        {
          name: "name",
          type: "text",
          required: true,
          options: {
            max: 255,
            min: 0,
            pattern: "",
          },
          hidden: false,
          presentable: true,
        },
        {
          name: "description",
          type: "text",
          required: false,
          options: {
            max: 0,
            min: 0,
            pattern: "",
          },
          hidden: false,
          presentable: false,
        },
        {
          name: "completed",
          type: "bool",
          required: false,
          hidden: false,
          presentable: false,
        },
        {
          name: "user",
          type: "relation",
          required: true,
          options: {
            collectionId: usersCollId,
            cascadeDelete: false,
            maxSelect: 1,
            minSelect: null,
            displayFields: ["email"],
          },
          hidden: false,
          presentable: false,
        },
      ],

      indexes: [
        "CREATE INDEX idx_todos_user ON todos (user)",
        "CREATE INDEX idx_todos_completed ON todos (completed)",
      ],
    });

    app.save(todosCollection);
    console.log("✓ Todos collection created");
  } catch (e) {
    console.error("Failed to create todos collection:", e);
    // Don't throw - allow migration to continue
    console.log("You can create the todos collection manually via Admin UI");
  }

  // ============================================================
  // 5. Initialize Application Settings (Optional)
  // ============================================================
  try {
    console.log("Configuring application settings...");

    const settings = app.settings();

    // Application metadata
    settings.meta.appName = "SvelteKit + PocketBase";
    settings.meta.appURL = $os.getenv("PUBLIC_POCKETBASE_URL") || "http://localhost:8090";

    // Logging
    settings.logs.maxDays = 7;
    settings.logs.logAuthId = false;
    settings.logs.logIP = true;

    // SMTP Configuration
    const smtpEnabled = $os.getenv("SMTP_ENABLED") || "false";
    settings.smtp.enabled = smtpEnabled === "true";

    if (settings.smtp.enabled) {
      console.log("Configuring SMTP settings...");

      settings.smtp.host = $os.getenv("SMTP_HOST") || "";
      settings.smtp.port = parseInt($os.getenv("SMTP_PORT") || "587", 10);
      settings.smtp.username = $os.getenv("SMTP_USER") || "";
      settings.smtp.password = $os.getenv("SMTP_PASS") || "";
      settings.smtp.tls = settings.smtp.port === 465 || settings.smtp.port === 587;

      // Parse sender from SMTP_FROM (e.g., "Name <email@example.com>")
      const smtpFrom = $os.getenv("SMTP_FROM") || "";
      if (smtpFrom) {
        // Extract email and name from format "Name <email@example.com>"
        const emailMatch = smtpFrom.match(/<(.+)>/);
        const nameMatch = smtpFrom.match(/^([^<]+)</);

        if (emailMatch && emailMatch[1]) {
          settings.meta.senderAddress = emailMatch[1].trim();
        }
        if (nameMatch && nameMatch[1]) {
          settings.meta.senderName = nameMatch[1].trim();
        }

        // If no angle brackets, assume it's just the email
        if (!emailMatch && smtpFrom.includes("@")) {
          settings.meta.senderAddress = smtpFrom.trim();
        }
      }

      console.log(`✓ SMTP configured: ${settings.smtp.host}:${settings.smtp.port}`);
    }

    app.save(settings);
    console.log("✓ Application settings configured");
  } catch (e) {
    console.error("Failed to configure settings:", e);
    // Don't throw - settings are non-critical
  }

  console.log("✓ Initial setup migration completed successfully");
}, (app) => {
  // ============================================================
  // Rollback: Clean up everything created by this migration
  // ============================================================
  console.log("Rolling back initial setup migration...");

  // Delete todos collection
  try {
    const todosCollection = app.findCollectionByNameOrId("todos");
    if (todosCollection) {
      app.delete(todosCollection);
      console.log("✓ Todos collection deleted");
    }
  } catch (e) {
    console.error("Failed to delete todos collection:", e);
  }

  // Delete posts collection
  try {
    const postsCollection = app.findCollectionByNameOrId("posts");
    if (postsCollection) {
      app.delete(postsCollection);
      console.log("✓ Posts collection deleted");
    }
  } catch (e) {
    console.error("Failed to delete posts collection:", e);
  }

  // Delete users collection
  try {
    const usersCollection = app.findCollectionByNameOrId("users");
    if (usersCollection) {
      app.delete(usersCollection);
      console.log("✓ Users collection deleted");
    }
  } catch (e) {
    console.error("Failed to delete users collection:", e);
  }

  // Delete superadmin
  try {
    const adminEmail = $os.getenv("POCKETBASE_ADMIN_EMAIL") || "admin@admin.local";
    const record = app.findAuthRecordByEmail("_superusers", adminEmail);
    if (record) {
      app.delete(record);
      console.log(`✓ Superadmin deleted: ${adminEmail}`);
    }
  } catch (e) {
    console.error("Failed to delete superadmin:", e);
  }

  console.log("✓ Rollback completed");
});
