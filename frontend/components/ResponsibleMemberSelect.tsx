'use client';
import {forwardRef,type ComponentProps} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api} from '@/lib/api';
import Select from './ui/Select';
export type TeamMember={id:string;display_name:string;email:string};
const ResponsibleMemberSelect=forwardRef<HTMLSelectElement,Omit<ComponentProps<typeof Select>,'options'>>(function ResponsibleMemberSelect(props,ref){
 const {data=[],isLoading,error}=useQuery({queryKey:['team-members'],queryFn:()=>api.get<TeamMember[]>('/employee-reports/members')});
 return <><Select {...props} ref={ref} aria-label="Responsible team member" options={[{value:'',label:isLoading?'Loading members…':'Unassigned — choose a member'},...data.map(m=>({value:m.id,label:m.display_name || m.email}))]} />{error && <p role="alert">Could not load team members. Try again later.</p>}</>;
});
export default ResponsibleMemberSelect;
