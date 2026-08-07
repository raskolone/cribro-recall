const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf8');

// Update hasOnlyAllowedFields in isValidUser
content = content.replace(
  /'hasNewLesson', 'dismissedNotifications'/g,
  "'hasNewLesson', 'hasNewHomework', 'dismissedNotifications'"
);

// Add rule for hasNewHomework
content = content.replace(
  /\(!\('hasNewLesson' in data\) \|\| data\.hasNewLesson is bool\) &&/g,
  "(!('hasNewLesson' in data) || data.hasNewLesson is bool) &&\n             (!('hasNewHomework' in data) || data.hasNewHomework is bool) &&"
);

// Update allow update affectedKeys
content = content.replace(
  /"hasNewLesson", "dismissedNotifications"/g,
  '"hasNewLesson", "hasNewHomework", "dismissedNotifications"'
);

fs.writeFileSync('firestore.rules', content);
console.log('Fixed firestore.rules');
