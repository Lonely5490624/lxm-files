var bcrypt = require('bcrypt')

const saltRounds = 10
const salt = bcrypt.genSaltSync()

// console.log(bcrypt.hashSync('123456', salt))
console.log(bcrypt.compareSync('1234567', '$2b$10$73k2a3RnjDQ1pGuLg.osGezByU3YmN5eV8d09WXoMNQrVnNWa0OV2'))