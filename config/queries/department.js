const query = require('./query')
const cwd = process.cwd()

function selectDepWithId(dep_id) {
    const sql = `SELECT * FROM lxm_user_department WHERE dep_id = ${dep_id}  AND is_delete = 0`
    return sql
}

function selectDepWithDir(dep_dir) {
    const sql = `SELECT * FROM lxm_user_department WHERE dep_dir = '${dep_dir}'  AND is_delete = 0`
    return sql
}

function selectDepLikePath(dep_dir) {
    const sql = `SELECT * FROM lxm_user_department WHERE dep_dir like '${dep_dir}%'  AND is_delete = 0`
    return sql
}

function selectDepAll() {
    const sql = `SELECT * FROM lxm_user_department WHERE is_delete = 0`
    return sql
}

function addDepartment(values) {
    const sql = `INSERT INTO lxm_user_department (
        dep_name,
        dep_dir,
        par_id,
        type,
        address,
        create_uid,
        create_time
    ) VALUES (
        '${values.dep_name}',
        '${values.dep_dir}',
        '${values.par_id}',
        '${values.type}',
        '${values.address || ''}',
        '${values.create_uid}',
        NOW()
    )`
    return sql
}

function updateDepNameWithId(dep_id, new_name, new_path, update_uid) {
    const sql = `UPDATE lxm_user_department SET dep_name = '${new_name}', dep_dir = '${new_path}', update_uid = '${update_uid}', update_time = NOW()  WHERE dep_id = ${dep_id} AND is_delete = 0`
    return sql
}

function updateDepPathWithPath(old_path, new_path, new_share_path, update_uid) {
    const sql = `UPDATE lxm_user_department SET dep_dir = '${new_path}', share_dir = '${new_share_path}', update_uid = '${update_uid}', update_time = NOW() WHERE dep_dir = '${old_path}'`
    return sql
}

module.exports = {
    selectDepWithId,
    selectDepWithDir,
    selectDepLikePath,
    selectDepAll,
    addDepartment,
    updateDepNameWithId,
    updateDepPathWithPath
}