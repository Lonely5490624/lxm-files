const query = require('./query')

function selectJobWithPath(path) {
    const sql = `SELECT * FROM lxm_user_job WHERE job_dir = '${path}' AND is_delete = 0`
    return sql
}

function selectJobWithId(job_id) {
    const sql = `SELECT * FROM lxm_user_job WHERE job_id = ${job_id} AND is_delete = 0`
    return sql
}

function selectJobWithDepId(dep_id) {
    const sql = `SELECT * FROM lxm_user_job WHERE dep_id = ${dep_id} AND is_delete = 0`
    return sql
}

function selectJobLikePath(path) {
    const sql = `SELECT * FROM lxm_user_job WHERE job_dir like '${path}%' AND is_delete = 0`
    return sql
}

function selectJobList() {
    const sql = `SELECT * FROM lxm_user_job`
    return sql
}

function addJob(values) {
    const sql = `INSERT INTO lxm_user_job (
        job_name,
        job_dir,
        dep_id,
        is_manager,
        dep_set,
        create_uid,
        create_time
    ) VALUES (
        '${values.job_name}',
        '${values.job_dir}',
        '${values.dep_id}',
        '${values.is_manager}',
        '${values.dep_set}',
        '${values.create_uid}',
        NOW()
    )`
    return sql
}

function updateJobNameWithId(job_id, new_name, new_path, update_uid) {
    const sql = `UPDATE lxm_user_job SET job_name = '${new_name}', job_dir = '${new_path}', update_uid = '${update_uid}', update_time = NOW()  WHERE job_id = ${job_id} AND is_delete = 0`
    return sql
}

function updateJobPathWithPath(old_path, new_path, new_share_path, update_uid) {
    const sql = `UPDATE lxm_user_job SET job_dir = '${new_path}', share_dir='${new_share_path}', update_uid = '${update_uid}', update_time = NOW() WHERE job_dir = '${old_path}'`
    return sql
}

module.exports = {
    selectJobWithPath,
    selectJobWithId,
    selectJobWithDepId,
    selectJobLikePath,
    selectJobList,
    addJob,
    updateJobNameWithId,
    updateJobPathWithPath
}