const query = require('./query')

const cwd = process.cwd()

function selectDirWithId(dir_id) {
    const sql = `SELECT * FROM lxm_file_dir WHERE dir_id = ${dir_id} AND is_delete = 0`
    return sql
}

function selectDirShareWithId(dir_id) {
    const sql = `SELECT * FROM lxm_file_dir_share WHERE dir_id = ${dir_id} AND is_delete = 0`
    return sql
}

function selectDirWithPid(dir_pid) {
    const sql = `SELECT * FROM lxm_file_dir WHERE dir_pid = ${dir_pid} AND is_delete = 0`
    return sql
}

function selectDirWithName(dir_name) {
    const sql = `SELECT * FROM lxm_file_dir WHERE dir_name = '${dir_name}' AND is_delete = 0`
    return sql
}

function selectDirWithPath(path) {
    const sql = `SELECT * FROM lxm_file_dir WHERE dir_path = '${path}' AND is_delete = 0`
    return sql
}

function selectDirShareWithPath(path) {
    const sql = `SELECT * FROM lxm_file_dir_share WHERE dir_path = '${path}' AND is_delete = 0`
    return sql
}

function selectDirLikePath(path) {
    const sql = `SELECT * FROM lxm_file_dir WHERE dir_path like '${path}%' AND is_delete = 0`
    return sql
}

function selectDirLikePathWithoutSelf(path) {
    const sql = `SELECT * FROM lxm_file_dir WHERE dir_path REGEXP '${path}.+' AND is_delete = 0`
    return sql
}

function selectShareDirWithPath(path) {
    const sql = `SELECT dir_path FROM lxm_file_dir WHERE dir_pid = (SELECT dir_id FROM lxm_file_dir WHERE dir_path = '${path}') AND is_share = 1 AND is_delete = 0`
    return sql
}

function addDir(values) {
    const sql = `INSERT INTO lxm_file_dir (
        dir_pid,
        dir_name,
        dir_path,
        uniq,
        depth,
        can_delete,
        create_uid,
        create_time
    ) VALUES (
        '${values.dir_pid}',
        '${values.dir_name}',
        '${values.path}',
        '${values.uniq}',
        '${values.path.split('/').length - 1}',
        ${values.can_delete || 0},
        '${values.create_uid}',
        NOW()
    )`
    return sql
}

function addDirShare(values) {
    const sql = `INSERT INTO lxm_file_dir_share (
        dir_pid,
        dir_name,
        dir_path,
        uniq,
        depth,
        create_uid,
        create_time
    ) VALUES (
        '${values.dir_pid || 0}',
        '${values.dir_name}',
        '${values.path}',
        '${values.uniq}',
        '${values.path.split('/').length - 1}',
        '${values.create_uid}',
        NOW()
    )`
    return sql
}

function updateDirNameWithPath(path, new_name, new_path, update_uid) {
    const sql = `UPDATE lxm_file_dir SET dir_name = '${new_name}', dir_path = '${new_path}', update_uid='${update_uid}', update_time = NOW() WHERE dir_path = '${path}'`
    return sql
}

function updateShareDirNameWithPath(path, new_name, new_path, update_uid) {
    const sql = `UPDATE lxm_file_dir_share SET dir_name = '${new_name}', dir_path = '${new_path}', update_uid='${update_uid}', update_time = NOW() WHERE dir_path = '${path}'`
    return sql
}

function updateDirNameOnlyWithPath(path, new_name, update_uid) {
    const sql = `UPDATE lxm_file_dir SET dir_name = '${new_name}', update_uid = '${update_uid}', update_time = NOW() WHERE dir_path = '${path}'`
    return sql
}

function updateDirPathWithPath(path, new_path, update_uid) {
    const sql = `UPDATE lxm_file_dir SET dir_path ='${new_path}', update_uid = '${update_uid}', update_time = NOW() WHERE dir_path = '${path}'`
    return sql
}

function deleteDirWithId(dir_id, uid) {
    const sql = `UPDATE lxm_file_dir SET is_delete = 1, delete_uid = '${uid}', delete_time = NOW() WHERE dir_id = ${dir_id}`
    return sql
}

module.exports = {
    selectDirWithId,
    selectDirShareWithId,
    selectDirWithPid,
    selectDirWithName,
    selectDirWithPath,
    selectDirShareWithPath,
    selectDirLikePathWithoutSelf,
    selectDirLikePath,
    selectShareDirWithPath,
    addDir,
    addDirShare,
    updateDirNameWithPath,
    updateShareDirNameWithPath,
    updateDirNameOnlyWithPath,
    updateDirPathWithPath,
    deleteDirWithId
}