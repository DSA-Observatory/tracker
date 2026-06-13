/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  try {
    app.findCollectionByNameOrId("cases");
    console.log("Cases collection already exists. Skipping creation.");
    return;
  } catch (e) {
    // Expected when the collection has not been created yet.
  }

  const casesCollection = new Collection({
    name: "cases",
    type: "base",
    system: false,

    listRule: "published = true || @request.auth.id != ''",
    viewRule: "published = true || @request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",

    fields: [
      { name: "case_id", type: "text", required: true, max: 80, min: 1, pattern: "", hidden: false, presentable: true },
      { name: "title", type: "text", required: true, max: 300, min: 1, pattern: "", hidden: false, presentable: true },
      { name: "ecli", type: "text", required: false, max: 160, min: 0, pattern: "", hidden: false, presentable: false },
      { name: "filing_date", type: "date", required: false, min: "", max: "", hidden: false, presentable: false },
      { name: "decision_date", type: "date", required: false, min: "", max: "", hidden: false, presentable: false },
      {
        name: "status",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["draft", "review", "pending", "decided", "appealed", "closed", "published"],
        hidden: false,
        presentable: false,
      },
      { name: "court", type: "text", required: false, max: 240, min: 0, pattern: "", hidden: false, presentable: false },
      { name: "jurisdiction", type: "text", required: false, max: 160, min: 0, pattern: "", hidden: false, presentable: false },
      { name: "plaintiffs", type: "json", required: false, maxSize: 2000000, hidden: false, presentable: false },
      { name: "defendants", type: "json", required: false, maxSize: 2000000, hidden: false, presentable: false },
      { name: "summary", type: "editor", required: false, maxSize: 0, convertURLs: true, hidden: false, presentable: false },
      { name: "keywords", type: "json", required: false, maxSize: 2000000, hidden: false, presentable: false },
      { name: "dsa_articles", type: "json", required: false, maxSize: 2000000, hidden: false, presentable: false },
      {
        name: "documents",
        type: "file",
        required: false,
        maxSelect: 20,
        maxSize: 52428800,
        mimeTypes: ["application/pdf", "text/plain", "text/html", "image/jpeg", "image/png", "image/webp"],
        thumbs: [],
        protected: false,
        hidden: false,
        presentable: false,
      },
      { name: "document_links", type: "json", required: false, maxSize: 2000000, hidden: false, presentable: false },
      { name: "citations_to", type: "json", required: false, maxSize: 2000000, hidden: false, presentable: false },
      { name: "cited_by", type: "json", required: false, maxSize: 2000000, hidden: false, presentable: false },
      { name: "commentary", type: "editor", required: false, maxSize: 0, convertURLs: true, hidden: false, presentable: false },
      { name: "published", type: "bool", required: false, hidden: false, presentable: false },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false, hidden: false, presentable: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true, hidden: false, presentable: false },
    ],

    indexes: [
      "CREATE UNIQUE INDEX idx_cases_case_id ON cases (case_id)",
      "CREATE INDEX idx_cases_published ON cases (published)",
      "CREATE INDEX idx_cases_status ON cases (status)",
      "CREATE INDEX idx_cases_jurisdiction ON cases (jurisdiction)",
      "CREATE INDEX idx_cases_decision_date ON cases (decision_date)",
      "CREATE INDEX idx_cases_title ON cases (title)",
    ],
  });

  app.save(casesCollection);
  console.log("✓ Cases collection created");
}, (app) => {
  try {
    const casesCollection = app.findCollectionByNameOrId("cases");
    app.delete(casesCollection);
    console.log("✓ Cases collection deleted");
  } catch (e) {
    console.error("Failed to delete cases collection:", e);
  }
});
