function orgchartObject(user, type = "Panel") {
  console.log(user.personalInformation,'sdfsdiuh')
  return {
    _id: user._id,
    name: user.personalInformation.firstName + " " + user.personalInformation.lastName,
    type: type,
    color: "#99ff99",
    role: user.employmentInformation.role,
    designation: user.employmentInformation.designation,
    employeeID: user.employmentInformation.employeeNumber,
    direct: 0,
    subOrdinates: 0,
    lineManager: user.employmentInformation.lineManager,
    jobCategory: user.employmentInformation.jobCategory,
    email: user.contactInformation.email,
    status: user.employmentInformation.status,
    profilePicture: user?.personalInformation?.profilePicture ? user?.personalInformation?.profilePicture : "",
    children: [],
    gender: user?.personalInformation?.gender ? user?.personalInformation?.gender : "",
  }
}
module.exports = orgchartObject;