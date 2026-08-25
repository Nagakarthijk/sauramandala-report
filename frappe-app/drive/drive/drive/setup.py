import frappe

def create_roles():
    for role in ("DRIVE Agent", "DRIVE Programme Officer", "DRIVE Provider"):
        if not frappe.db.exists("Role", role):
            frappe.get_doc({"doctype": "Role", "role_name": role}).insert()
    frappe.db.commit()
