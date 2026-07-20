const { gsap } = require('gsap');

try {
  gsap.to([], {x: 100});
  console.log("Empty array ok");
} catch(e) { console.error("Array error:", e.message) }

try {
  gsap.to("", {x: 100});
  console.log("Empty string ok");
} catch(e) { console.error("String error:", e.message) }

try {
  gsap.to(null, {x: 100});
  console.log("Null ok");
} catch(e) { console.error("Null error:", e.message) }
