import frappe
from frappe.model.document import Document

class Provider(Document):
    def before_insert(self):
        if not self.company:
            self.company = frappe.defaults.get_user_default("Company")
