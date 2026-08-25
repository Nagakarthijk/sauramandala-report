import frappe
from frappe.model.document import Document

class Entrepreneur(Document):
    def before_insert(self):
        if not self.company:
            self.company = frappe.defaults.get_user_default("Company")
        if not self.stage:
            self.stage = "lead"

    def after_insert(self):
        # Create a timeline comment so programme officers can see the registration
        frappe.get_doc({
            "doctype": "Comment",
            "comment_type": "Info",
            "reference_doctype": "Entrepreneur",
            "reference_name": self.name,
            "content": f"Registered by {frappe.session.user}",
        }).insert(ignore_permissions=True)


def has_permission(doc, ptype, user):
    # Agents can only see entrepreneurs in their company
    if frappe.has_role("DRIVE Programme Officer", user) or frappe.has_role("Administrator", user):
        return True
    user_company = frappe.defaults.get_user_default("Company", user)
    return doc.company == user_company
