import {
  QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryOptions,
} from "@tanstack/react-query";
import { AxiosError } from "axios";
import showToast from "../components/custom_ui/toast";
import {
  CreateDataPayload,
  QueryOptions,
  UpdateDataPayload,
} from "../types/helpers/query_data";
import {
  deleteData,
  getData,
  getSingleData,
  postData,
  updateData,
} from "../utils/backend_access";
import buildQuery from "../utils/query_builder";

export function useGetData<TData>(
  apiPath: string,
  queryKey: string,
  options?: QueryOptions,
  headers?: Record<string, string>,
  queryOptions?: UseQueryOptions<TData[], AxiosError, TData[], QueryKey>
) {
  return useQuery<TData[], AxiosError>({
    ...queryOptions,
    queryKey: [queryKey],
    queryFn: () =>
      getData<TData>(
        `${apiPath}${options ? `/${buildQuery(options)}` : ""}`,
        headers
      ),
    refetchOnWindowFocus: false,
  });
}

export function useGetSingleData<TData>(
  apiPath: string,
  queryKey: string,
  id?: string,
  options?: QueryOptions,
  headers?: Record<string, string>,
  queryOptions?: UseQueryOptions<TData, AxiosError, TData, QueryKey>,
  singleResponse?: boolean
) {
  return useQuery<TData, AxiosError>({
    ...queryOptions,
    queryKey: [queryKey],
    queryFn: () => {
      if (id || singleResponse) {
        return getSingleData(apiPath, id, headers);
      }

      const data = getData<TData>(
        `${apiPath}${options ? `/${buildQuery(options)}` : ""}`,
        headers
      );

      if (Array.isArray(data)) {
        if (data.length === 1) return data[0];
        throw Error("Expected a single item but received an array");
      }
    },
    refetchOnWindowFocus: false,
  });
}

export function useCreateData<TData, TResponse = void>(
  apiPath: string,
  queryKey?: string,
  customSucessText?: string,
  customErrorText?: string,
  headers?: Record<string, string>
) {
  const queryClient = useQueryClient();
  return useMutation<TResponse, AxiosError, CreateDataPayload<TData>>({
    mutationFn: ({ id, value }) => {
      return postData<TData, TResponse>(apiPath, value, id, headers);
    },
    onSuccess: () => {
      if (customSucessText !== "")
        showToast("success", customSucessText ?? "Successfully created");
      if (queryKey) {
        const keys = queryKey.includes(";")
          ? queryKey
              .split(";")
              .map((k) => k.trim())
              .filter(Boolean)
          : [queryKey.trim()];

        keys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      }
    },
    onError: () => {
      if (customErrorText !== "")
        showToast("error", customErrorText ?? "Creation failed");
    },
  });
}

export function useUpdateData<TData, TResponse = void>(
  apiPath: string,
  queryKey?: string,
  customSucessText?: string,
  customErrorText?: string,
  headers?: Record<string, string>
) {
  const queryClient = useQueryClient();
  return useMutation<TResponse, AxiosError, UpdateDataPayload<TData>>({
    mutationFn: ({ id, value }) => {
      return updateData<TData, TResponse>(apiPath, id, value, headers);
    },
    onSuccess: () => {
      if (customSucessText !== "")
        showToast("success", customSucessText ?? "Successfully updated");
      if (queryKey) {
        const keys = queryKey.includes(";")
          ? queryKey
              .split(";")
              .map((k) => k.trim())
              .filter(Boolean)
          : [queryKey.trim()];

        keys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      }
    },
    onError: () => {
      if (customErrorText !== "")
        showToast("error", customErrorText ?? "Update failed");
    },
  });
}

export function useDeleteData(
  apiPath: string,
  queryKey?: string,
  customSucessText?: string,
  customErrorText?: string,
  headers?: Record<string, string>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number) => {
      return deleteData(apiPath, id, headers);
    },
    onSuccess: () => {
      if (customSucessText !== "")
        showToast("success", customSucessText ?? "Successfully deleted");
      if (queryKey) {
        const keys = queryKey.includes(";")
          ? queryKey
              .split(";")
              .map((k) => k.trim())
              .filter(Boolean)
          : [queryKey.trim()];

        keys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      }
    },
    onError: () => {
      if (customErrorText !== "")
        showToast("error", customErrorText ?? "Delete failed");
    },
  });
}
