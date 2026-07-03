from django.contrib import admin
from .models import Creator, ContractingCompliance, CommercialDeal, EmployeeWeeklyReport, DropOff

admin.site.register(Creator)
admin.site.register(ContractingCompliance)
admin.site.register(CommercialDeal)
admin.site.register(EmployeeWeeklyReport)
admin.site.register(DropOff)
