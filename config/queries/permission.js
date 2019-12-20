function selectPermissionWithUid(uid) {
    const sql = `SELECT * FROM lxm_user_permission WHERE job_id = (SELECT job_id FROM lxm_user_staff WHERE uid = '${uid}')`
    return sql
}

function addJobPermission(values) {
    const sql = `INSERT INTO lxm_user_permission (
        job_id,
        create_user,
        modify_userinfo,
        create_dir,
        upload_file,
        download_file,
        delete_file,
        delete_dir,
        rename_file,
        rename_dir
    ) VALUES (
        ${values.job_id},
        ${values.create_user || 0},
        ${values.modify_userinfo || 0},
        ${values.create_dir || 0},
        ${values.upload_file || 0},
        ${values.download_file || 0},
        ${values.delete_file || 0},
        ${values.delete_dir || 0},
        ${values.rename_file || 0},
        ${values.rename_dir || 0}
    )`
    return sql
}

module.exports = {
    selectPermissionWithUid,
    addJobPermission
}