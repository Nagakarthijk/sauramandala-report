app_name = "drive"
app_title = "DRIVE"
app_publisher = "Sauramandala Foundation"
app_description = "Doorstep Incubation for Thriving Enterprises — field case management for micro-entrepreneurs"
app_email = "nk@sauramandala.org"
app_license = "MIT"

# Roles created on install
has_permission = {
    "Entrepreneur" : "drive.drive.drive.doctype.entrepreneur.entrepreneur.has_permission",
    "Referral"     : "drive.drive.drive.doctype.referral.referral.has_permission",
}

# Auto-link new users to a default company
on_login = "drive.drive.api.on_login"
