import type { Product } from "@/types/product";

export const siteConfig = {
  name: "UAMSATech",
  url: "https://uamsatech.com",
  description:
    "UAMSATech builds a unified ecosystem of AI-powered academic software for universities, lecturers, researchers, registrars, and students across Africa.",
  tagline: "Intelligent software for higher education.",
  links: {
    portal: "https://portal.uamsatech.com",
    auth: "https://auth.uamsatech.com",
    docs: "https://docs.uamsatech.com",
  },
};

export type { Product };

export const products: Product[] = [
  {
    slug: "uamsa",
    name: "UAMSA",
    tagline: "University Academic Management System",
    description:
      "A complete university ERP and Student Information System covering admissions through graduation.",
    audience: ["Universities"],
    features: [
      "Admissions",
      "Student Management",
      "Staff Management",
      "Academic Structure",
      "Course Registration",
      "Results",
      "Transcript Management",
      "Fees",
      "Messaging",
      "Analytics",
    ],
    benefits: [
      {
        title: "One system of record",
        description:
          "Admissions, results, and fees stop living in separate tools that need manual reconciliation.",
      },
      {
        title: "Faster registration & results",
        description:
          "Students and staff self-serve course registration and results instead of routing paperwork by hand.",
      },
      {
        title: "Built for institution scale",
        description:
          "Designed for a full university rollout from day one, not a departmental pilot that needs re-architecting later.",
      },
    ],
    deployment: ["Institution only"],
    subdomain: "uamsa.uamsatech.com",
    pricingPlans: ["institution"],
    accent: "navy",
    isLive: true,
  },
  {
    slug: "lecturesuite",
    name: "LectureSuite",
    tagline: "AI-powered teaching platform",
    description:
      "Give every lecturer an AI teaching assistant for lecture notes, assessments, and course materials.",
    audience: ["Individual lecturers", "Universities"],
    features: [
      "Lecture Notes",
      "Lesson Plans",
      "Question Generator",
      "Assignment Generator",
      "Exam Builder",
      "Rubrics",
      "Marking Schemes",
      "Course Outlines",
      "Presentation Generator",
      "AI Teaching Assistant",
    ],
    benefits: [
      {
        title: "Hours back every week",
        description:
          "AI drafts lecture notes, questions, and rubrics so you start from an edit, not a blank page.",
      },
      {
        title: "Consistent assessment quality",
        description:
          "Shared question banks and marking schemes keep grading consistent across a course, not down to individual lecturers.",
      },
      {
        title: "Works with or without UAMSA",
        description:
          "Start as an individual lecturer, and adopt institution-wide later without switching tools.",
      },
    ],
    deployment: ["Individual", "Institution", "Integrated with UAMSA"],
    subdomain: "lecturesuite.uamsatech.com",
    pricingPlans: ["individual", "institution"],
    accent: "blue",
    isLive: true,
  },
  {
    slug: "scholarsuite",
    name: "ScholarSuite",
    tagline: "AI-powered study companion for students",
    description:
      "Plan your studies and revision, set goals, track your GPA and assignments, learn with an AI tutor, turn your notes into flashcards and quizzes, check your work before you submit, draft your thesis, and join your lecturers' classes, all in one place.",
    audience: ["Students", "Universities"],
    features: [
      "Study Planner & Timetable",
      "Revision Planner",
      "Goal Tracking",
      "Assignment Tracker",
      "AI Tutor",
      "Flashcards, Summaries & Quizzes",
      "GPA Calculator",
      "Plagiarism & AI Check",
      "Thesis Workspace",
      "Class Connect",
    ],
    benefits: [
      {
        title: "Your whole semester in one place",
        description:
          "Tasks, deadlines, timetable, and GPA live together, instead of in separate apps and spreadsheets.",
      },
      {
        title: "Revise from your own notes",
        description:
          "Upload lecture notes and get flashcards, summaries, and practice quizzes pitched at your level of study.",
      },
      {
        title: "Connected to your lecturers",
        description:
          "Join a class from LectureSuite with a code to see announcements, materials, and assignments, and submit your work.",
      },
    ],
    deployment: ["Individual", "Institution", "Integrated with UAMSA"],
    subdomain: "scholarsuite.uamsatech.com",
    pricingPlans: ["individual", "institution"],
    accent: "gold",
    isLive: false,
  },
  {
    slug: "researchsuite",
    name: "ResearchSuite",
    tagline: "AI-powered thesis and research writing platform",
    description:
      "Guided thesis, proposal, and journal-article writing for students and researchers, from topic to a submission-ready Word document.",
    audience: ["Students", "Researchers", "Universities"],
    features: [
      "Thesis & Project Wizard",
      "Proposals",
      "Journal & Conference Papers",
      "Literature Search",
      "Chapter Guides",
      "Paraphraser",
      "Summarizer",
      "Similarity Checker",
      "Word Export",
    ],
    benefits: [
      {
        title: "From topic to formatted draft",
        description:
          "A stage-by-stage wizard builds each chapter, then compiles the whole document with a title page in a submission-ready Word format.",
      },
      {
        title: "Grounded in real sources",
        description:
          "Literature search draws on CrossRef and Semantic Scholar, and AI suggestions are clearly marked for checking before you cite them.",
      },
      {
        title: "Writing tools beside the draft",
        description:
          "Paraphrasing, summarising, and a similarity check in the same place as the thesis, instead of copying text between separate tools.",
      },
    ],
    deployment: ["Individual", "Institution"],
    subdomain: "researchsuite.uamsatech.com",
    pricingPlans: ["individual", "institution"],
    accent: "navy",
    isLive: true,
  },
  {
    slug: "records",
    name: "Records",
    tagline: "Academic Records Management Platform",
    description:
      "Generate and verify transcripts, results, and academic records at institutional scale.",
    audience: ["Registrars", "Examination Officers", "Universities"],
    features: [
      "Transcript Generator",
      "Composite Result Generator",
      "Student Academic Record Generator",
      "Mark Sheet Generator",
      "Excel Import",
      "QR Verification",
      "Result Processing",
    ],
    benefits: [
      {
        title: "Verifiable at a glance",
        description:
          "QR verification makes it easy for third parties to confirm a transcript or result is genuine.",
      },
      {
        title: "No more manual re-entry",
        description:
          "Excel import brings existing result data in directly instead of retyping records by hand.",
      },
      {
        title: "Works with what you already have",
        description:
          "Standalone, integrated with UAMSA, or alongside a third-party student information system.",
      },
    ],
    deployment: [
      "Standalone",
      "Integrated with UAMSA",
      "Third-party SIS Integration",
    ],
    subdomain: "records.uamsatech.com",
    pricingPlans: ["standalone", "institution"],
    accent: "navy",
    isLive: false,
  },
  // StudyFlow was retired: its features (study planner, AI tutor, goal tracking,
  // revision planner, assignment tracker) are part of ScholarSuite.
  // /products/studyflow redirects to /products/scholarsuite (next.config.ts).
];

export const mainNav = [
  { title: "Products", href: "/products" },
  { title: "Solutions", href: "/solutions" },
  { title: "Pricing", href: "/pricing" },
  { title: "Customers", href: "/customers" },
  { title: "Docs", href: "/docs" },
  { title: "Blog", href: "/blog" },
];

export const footerNav = {
  Product: [
    { title: "All Products", href: "/products" },
    { title: "Pricing", href: "/pricing" },
    { title: "Solutions", href: "/solutions" },
    { title: "Integrations", href: "/products#integrations" },
  ],
  Company: [
    { title: "About", href: "/about" },
    { title: "Careers", href: "/careers" },
    { title: "Customers", href: "/customers" },
    { title: "Contact", href: "/contact" },
  ],
  Resources: [
    { title: "Documentation", href: "/docs" },
    { title: "Blog", href: "/blog" },
    { title: "Support", href: "/support" },
    { title: "Status", href: "/status" },
  ],
  Legal: [
    { title: "Privacy Policy", href: "/privacy" },
    { title: "Terms of Service", href: "/terms" },
  ],
};
