function selectFileWithPath(path) {
    const sql = `SELECT * FROM lxm_file_file WHERE file_path = '${path}' AND is_delete = 0`
    return sql
}

function selectFileShareWithPath(path) {
    const sql = `SELECT * FROM lxm_file_file_share WHERE file_path = '${path}' AND is_delete = 0`
    return sql
}

function selectFileWithDirId(dir_id) {
    const sql = `SELECT * FROM lxm_file_file WHERE dir_id = ${dir_id} AND is_delete = 0`
    return sql
}

function selectShareFileWithDirId(dir_id) {
    const sql = `SELECT * FROM lxm_file_file_share WHERE dir_id = ${dir_id} AND is_delete = 0`
    return sql
}

function selectFileWithFileId(file_id) {
    const sql = `SELECT * FROM lxm_file_file WHERE file_id = ${file_id} AND is_delete = 0`
    return sql
}

function selectFileLikePath(file_path) {
    const sql = `SELECT * FROM lxm_file_file WHERE file_path like '${file_path}%' AND is_delete = 0`
    return sql
}

function addFile(values) {
    const sql = `INSERT INTO lxm_file_file (
        dir_id,
        file_name,
        file_path,
        type,
        ext,
        size,
        uniq,
        create_uid,
        create_time
    ) VALUES (
        ${values.dir_id},
        '${values.file_name}',
        '${values.file_path}',
        ${values.type},
        '${values.ext}',
        '${values.size}',
        '${values.uniq}',
        '${values.create_uid}',
        NOW()
    )`
    return sql
}

function addFileShare(values) {
    const sql = `INSERT INTO lxm_file_file_share (
        dir_id,
        file_name,
        file_path,
        type,
        ext,
        size,
        uniq,
        create_uid,
        create_time
    ) VALUES (
        ${values.dir_id},
        '${values.file_name}',
        '${values.file_path}',
        ${values.type},
        '${values.ext}',
        '${values.size}',
        '${values.uniq}',
        '${values.create_uid}',
        NOW()
    )`
    return sql
}

function updateFileName(file_id, new_name, new_path, new_ext, update_uid) {
    const sql = `UPDATE lxm_file_file SET file_name = '${new_name}', file_path = '${new_path}', ext = '${new_ext}', update_uid = '${update_uid}', update_time = NOW() WHERE file_id = ${file_id} AND is_delete = 0`
    return sql
}

function updateFilePath(old_path, new_path, uid) {
    const sql = `UPDATE lxm_file_file SET file_path = '${new_path}', update_uid = '${uid}', update_time = NOW() WHERE file_path = '${old_path}' AND is_delete = 0`
    return sql
}

function deleteFileWithFileId(file_id, uid) {
    const sql = `UPDATE lxm_file_file SET is_delete = 1, delete_uid = '${uid}', delete_time = NOW() WHERE file_id = ${file_id}`
    return sql
}

module.exports = {
    selectFileWithPath,
    selectFileShareWithPath,
    selectFileWithDirId,
    selectFileWithFileId,
    selectShareFileWithDirId,
    selectFileLikePath,
    addFile,
    addFileShare,
    updateFileName,
    updateFilePath,
    deleteFileWithFileId
}