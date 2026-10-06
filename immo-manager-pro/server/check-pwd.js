import bcrypt from 'bcryptjs';
const hash = '$2b$10$vOlQ0b1QIwdJqHMwdU2VZO7hg0nLaSJowePT8mf1tJRdhMu7k1FPa';
const pwd = '77916407@@Mu';
bcrypt.compare(pwd, hash).then(console.log);
