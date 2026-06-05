import { isEmailMatch } from "../src/lib/simulator/engine";

console.log("ceo@company.com vs @ceo_official:", isEmailMatch("ceo@company.com", "@ceo_official"));
console.log("@ceo_official vs ceo@company.com:", isEmailMatch("@ceo_official", "ceo@company.com"));
console.log("alex.manager@company.com vs @alex_manager:", isEmailMatch("alex.manager@company.com", "@alex_manager"));
console.log("billing@aws.amazon.com vs @aws_billing:", isEmailMatch("billing@aws.amazon.com", "@aws_billing"));
console.log("sarah.dev@company.com vs @sarah_dev:", isEmailMatch("sarah.dev@company.com", "@sarah_dev"));
