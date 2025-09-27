import { backendAxios } from "../const/backendAccessConfiguration";

export async function postData<TData>(
  url: string,
  data: TData,
  headers?: Record<string, string>
): Promise<void>;
export async function postData<TData, TResponse>(
  url: string,
  data: TData,
  headers?: Record<string, string>
): Promise<TResponse>;

export async function postData<TData, TResponse>(
  url: string,
  data: TData,
  headers?: Record<string, string>
): Promise<TResponse> {
  const response = await backendAxios.post<TResponse>(url, data, { headers });
  return response.data;
}

export async function getData<TResponse>(
  url: string,
  headers?: Record<string, string>
): Promise<TResponse[]> {
  const response = await backendAxios.get<TResponse[]>(url, { headers });
  return response.data;
}

export async function getDataById<TResponse>(
  url: string,
  id?: string | number,
  headers?: Record<string, string>
): Promise<TResponse> {
  const response = await backendAxios.get<TResponse>(
    id ? `${url}/${id}` : url,
    { headers }
  );
  return response.data;
}

export async function updateData<TData>(
  url: string,
  id: string | number,
  data: TData,
  headers?: Record<string, string>
): Promise<void>;
export async function updateData<TData, TResponse>(
  url: string,
  id: string | number,
  data: TData,
  headers?: Record<string, string>
): Promise<TResponse>;

export async function updateData<TData, TResponse>(
  url: string,
  id: string | number,
  data: TData,
  headers?: Record<string, string>
): Promise<TResponse> {
  const response = await backendAxios.put<TResponse>(`${url}/${id}`, data, {
    headers,
  });
  return response.data;
}

export async function deleteData(
  url: string,
  id: string | number,
  headers?: Record<string, string>
): Promise<void> {
  await backendAxios.delete(`${url}/${id}`, {
    headers,
  });
}
