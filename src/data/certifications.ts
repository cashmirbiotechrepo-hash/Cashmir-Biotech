/** Regulatory and startup certifications — images live in /public/certifications */
export const CERTIFICATIONS = [
  {
    id: "startup",
    title: "Startup Recognition Certificate",
    description: "Recognised under India's startup initiative for biotech innovation.",
    imageUrl: "/certifications/startup-recognition.jpg"
  },
  {
    id: "fssai",
    title: "FSSAI License",
    description: "Food safety licence for manufacturing and distribution of health supplements.",
    imageUrl: "/certifications/fssai-license.jpeg"
  },
  {
    id: "rir",
    title: "RIR Certification",
    description: "Research and innovation recognition supporting our scientific operations.",
    imageUrl: "/certifications/rir-certification.jpeg"
  },
  {
    id: "registration-1",
    title: "Company Registration",
    description: "Official registration certificate — Cashmir Biotech Pvt Ltd.",
    imageUrl: "/certifications/registration-page-1.jpg"
  },
  {
    id: "registration-2",
    title: "Registration Certificate (continued)",
    description: "Supplementary registration documentation.",
    imageUrl: "/certifications/registration-page-2.jpg"
  }
] as const;

export const IP_PORTFOLIO_STATS = [
  { label: "Indian Granted Patents", value: "7" },
  { label: "Inventorship Certificates", value: "3" },
  { label: "Registered Design", value: "1" },
  { label: "Registered Trademark", value: "1" },
  { label: "International Utility Model", value: "1" }
] as const;
